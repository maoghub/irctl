package control

import (
	"fmt"
	"io/ioutil"
	"strconv"
	"sync"
	"time"

	log "github.com/golang/glog"
	"github.com/kylelemons/godebug/pretty"
)

const (
	// runInterval is the amount of time to sleep before running again.
	runInterval = 10 * time.Minute
	// dateFormat is the string format for dates.
	dateFormat = "2006-Jan-02"
	// timeOfDayFormat is the string format for time of day.
	timeOfDayFormat = "15:04"
)

var (
	// CommandRunningMu locks CommandRunning.
	CommandRunningMu sync.RWMutex
	// CommandRunning reports whether a manual or auto command is currently
	// running. It should be set to true under lock before commencing an
	// operation that can turn on a valve.
	CommandRunning = false
	// doInit set to true causes Run to be skipped once only.
	doInit = false
)

// RunParams is a collection of run options.
type RunParams struct {
	// Config is the config to use. If empty, the file contents at ConfigPath
	// are used instead.
	Config string
	// ConfigPath is the file path of the config file.
	ConfigPath string
	// DataLogPath is the root path of the data logs.
	DataLogPath string
	// DontSleep avoids sleep when set to true. Used for testing only.
	DontSleep bool
}

const (
	ZoneStateKey         = "ZoneState"
	LastRunDateKey       = "LastRunDate"
	LastZoneResetDateKey = "LastZoneResetDate"
	CurrentVWCKey        = "CurrentVWC"
)

// Run repeatedly runs the entire action, with a sleep interval of runInterval.
// It uses:
//   kv to persist run state
//   cg to get current conditions
//   zc to control zones
//   er to report errors
// Never exits.
func Run(rparam *RunParams, kv KVStore, cg ConditionsGetter, zc ZoneController, er ErrorReporter, init bool) {
	log.Infof("control.Run called with \n%v\nKV store (%T), ConditionsGetter(%T), ZoneController(%T), ErrorReporter(%T), init=%v)",
		pretty.Sprint(*rparam), kv, cg, zc, er, init)
	ctrl := NewController(rparam, kv, cg, zc, er)
	for {
		if _, err := ctrl.RunOnce(time.Now()); err != nil {
			er.Report(err)
		}
		doInit = false
		time.Sleep(runInterval)
	}
}

// Controller is the top level irrigation controller.
type Controller struct {
	rparam           *RunParams
	systemConfig     *SystemConfig
	algorithm        ETAlgorithm
	kvStore          KVStore
	conditionsGetter ConditionsGetter
	zoneController   ZoneController
	dataLogger       *DataLogger
	errorReporter    ErrorReporter
}

// NewController creates an initialized Controller and returns a pointer to it.
func NewController(rparam *RunParams, kv KVStore, cg ConditionsGetter, zc ZoneController, er ErrorReporter) *Controller {
	return &Controller{
		rparam:           rparam,
		kvStore:          kv,
		conditionsGetter: cg,
		zoneController:   zc,
		errorReporter:    er,
	}
}

// RunOnce runs the entire action once. It returns a bool to indicate whether
// the action was run, and an error. The action is not run either if it has
// already completed today, or is not yet scheduled to run.
// It uses:
//   kv to persist run state
//   cg to get current conditions
//   zc to control zones
//   er to report errors
func (c *Controller) RunOnce(now time.Time) (bool, error) {
	log.Infof("RunOnce at time %s.", now.Format("Mon 2 Jan 2006 15:04"))

	if CommandRunning {
		log.Infof("Manual command is running, will retry later.")
		return false, nil
	}

	// Locking excludes manual runs from happening.
	CommandRunningMu.Lock()
	defer CommandRunningMu.Unlock()

	// Every time, if not running manually, close all valves directly on the
	// valve controller as a safety/recovery measure.
	c.zoneController.TurnAllOff()
	if alreadyRan, err := checkIfRanToday(c.kvStore, now); alreadyRan || err != nil {
		//log.Infof("Already ran today, exiting.")
		return alreadyRan, err
	}

	var err error
	c.systemConfig, c.algorithm, err = readConfig(c.rparam)
	if err != nil {
		return false, err
	}
	log.Infof("Read config from %s.", c.rparam.ConfigPath)

	// Reset zone states from Complete to Idle once per day.
	if err := resetZones(c.zoneController, c.kvStore, now, c.systemConfig.NumZones()); err != nil {
		return false, err
	}

	// If current time is before scheduled run time, exit.
	log.Infof("Current time is %s, scheduled time is %s.", now.Format(timeOfDayFormat), c.systemConfig.GlobalConfig.RunTimeAM.Format(timeOfDayFormat))
	if tooEarly(now, c.systemConfig.GlobalConfig.RunTimeAM) {
		//log.Infof("Too early, exiting.")
		return false, nil
	}

	c.dataLogger = NewDataLogger(c.rparam.DataLogPath)

	tempYesterday, precipYesterday, _, precipForecast, err := c.getConditions(now)
	if err != nil {
		return false, err
	}

	runtimes, err := c.calculateRuntimes(tempYesterday, precipYesterday, precipForecast, now)
	if err != nil {
		return false, err
	}

	if err := c.runZones(runtimes); err != nil {
		return false, c.errorReporter.Report(err)
	}

	log.Infof("Writing runtimes.")
	if err := c.dataLogger.WriteRuntimes(now, c.systemConfig.NumZones(), runtimes); err != nil {
		return true, c.errorReporter.Report(err)
	}

	log.Infof("Updating last run time.")
	if err := c.kvStore.Set(LastRunDateKey, now.Format(dateFormat)); err != nil {
		return true, c.errorReporter.Report(err)
	}

	return true, nil
}

func (c *Controller) getConditions(now time.Time) (tempY, precipY, tempT, precipT float64, err error) {
	log.Infof("Getting conditions.")
	// Check conditions.
	iconYesterday, tempYesterday, precipYesterday, err := c.conditionsGetter.GetYesterday(c.systemConfig.GlobalConfig.AirportCode)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	if err := c.dataLogger.WriteConditions(yesterday(now), iconYesterday, tempYesterday, precipYesterday); err != nil {
		c.errorReporter.Report(err)
	}
	iconForecast, tempForecast, precipForecast, err := c.conditionsGetter.GetForecast(c.systemConfig.GlobalConfig.AirportCode)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	if err := c.dataLogger.WriteConditions(now, iconForecast, tempForecast, precipForecast); err != nil {
		c.errorReporter.Report(err)
	}
	log.Infof("Yesterday: %s / %3.1f degF / %1.1f In, Forecast: %s /  %3.1f degF / %1.1f In",
		iconYesterday, tempYesterday, precipYesterday, iconForecast, tempForecast, precipForecast)

	return tempYesterday, precipYesterday, tempForecast, precipForecast, nil
}

func (c *Controller) calculateRuntimes(tempYesterday, precipYesterday, precipForecast float64, now time.Time) (map[int]time.Duration, error) {
	runtimes := make(map[int]time.Duration)
	for znum := 0; znum < c.systemConfig.NumZones(); znum++ {
		z, ok := c.systemConfig.ZoneConfigs[znum]
		if !ok {
			// zone is not defined in the config.
			continue
		}
		vWC, err := GetVWC(c.kvStore, znum)
		if err != nil {
			c.errorReporter.Report(err)
			continue
		}
		newVWC, err := c.algorithm.CalculateVWC(Pct(vWC), tempYesterday, precipYesterday, now, z)
		if err != nil {
			c.errorReporter.Report(err)
			continue
		}
		log.Infof("Zone %d VWC: %3.2f -> %3.2f", znum, vWC, newVWC)
		// Check if VWC is below the threshold. If so, run the zone, otherwise
		// just update it to new value.
		if newVWC >= z.MinVWC {
			if err := updateStateAndVWC(c.zoneController, c.kvStore, znum, float64(newVWC)); err != nil {
				c.errorReporter.Report(err)
				continue
			}
			log.Infof("Update VWC to %3.2f, don't run zone.", newVWC)
		} else {
			runDuration, err := c.algorithm.CalculateRuntime(newVWC, z.MaxVWC, precipForecast, z)
			if err != nil {
				c.errorReporter.Report(err)
				continue
			}
			runtimes[znum] = time.Duration(float64(runDuration.Nanoseconds()) * z.RunTimeMultiplier)
			log.Infof("Below minimum of %3.2f, run time is %2.0f mins x mult of %1.1f = %3.0f minutes.", z.MinVWC, runDuration.Minutes(), z.RunTimeMultiplier, runtimes[znum].Minutes())
		}
	}

	return runtimes, nil
}

func (c *Controller) runZones(runtimes map[int]time.Duration) error {
	for znum := 0; znum < c.systemConfig.NumZones(); znum++ {
		runtime, ok := runtimes[znum]
		if !ok {
			continue
		}
		z, ok := c.systemConfig.ZoneConfigs[znum]
		if !ok {
			// zone is not defined in the config.
			continue
		}

		zs, err := c.zoneController.State(znum)
		if err != nil {
			c.errorReporter.Report(err)
			continue
		}
		log.Infof("Zone %d state is %s.", znum, zs)

		if zs == Complete {
			// This zone already ran and VWC was updated.
			continue
		}
		dontRun := false
		if zs == Running || zs == Unknown {
			log.Errorf("Zone %d still Running, turning off", znum)
			c.zoneController.TurnOff(znum)
			// It's not known how long the zone was running, therefore just
			// shut it off and don't run it any more today.
			dontRun = true
			continue
		}

		if !dontRun {
			err = c.zoneController.Run(znum, runtime, c.rparam.DontSleep)
			if err != nil {
				c.errorReporter.Report(err)
				continue
			}
		}
		if err := updateStateAndVWC(c.zoneController, c.kvStore, znum, float64(z.MaxVWC)); err != nil {
			c.errorReporter.Report(err)
			continue
		}
		log.Infof("Set VWC to max %3.2f after run.", z.MaxVWC)
	}

	return nil
}

// checkIfRanToday reports whether the action was already run today.
func checkIfRanToday(kv KVStore, now time.Time) (bool, error) {
	lrStr, found, err := kv.Get(LastRunDateKey)
	if err != nil {
		return false, fmt.Errorf("kv.Get(LastRunDateKey): %s", err)
	}
	if found {
		lrTime, err := time.Parse(dateFormat, lrStr)
		if err != nil {
			return false, fmt.Errorf("time.Parse(%s): %s", lrStr, err)
		}
		if datesAreEqual(now, lrTime) {
			return true, nil
		}
	}
	return false, nil
}

// readConfig reads the config.
func readConfig(rparam *RunParams) (*SystemConfig, ETAlgorithm, error) {
	config := rparam.Config
	if config == "" {
		scb, err := ioutil.ReadFile(rparam.ConfigPath)
		if err != nil {
			return nil, nil, fmt.Errorf("could not read config file at %s: %s", rparam.ConfigPath, err)
		}
		config = string(scb)
	}
	sc := &SystemConfig{}
	err := sc.Parse(config)
	if err != nil {
		return nil, nil, fmt.Errorf("could not parse config file: %s\n\n%s", err, config)
	}

	var alg ETAlgorithm
	switch {
	case sc.ETAlgorithmSimpleConfig != nil:
		alg = NewETAlgorithmSimple(sc.ETAlgorithmSimpleConfig.EtPctMap)
	default:
		return nil, nil, fmt.Errorf("unable to create an alg without parameters")
	}

	return sc, alg, nil
}

// resetZones changes any zone state which is Complete to Idle. It performs
// this action once per day.
func resetZones(zc ZoneController, kv KVStore, now time.Time, numZones int) error {
	lresetStr, found, err := kv.Get(LastZoneResetDateKey)
	if err != nil {
		return fmt.Errorf("kv.Get(LastZoneResetDateKey): %s", err)
	}
	doReset := false
	if found {
		lrTime, err := time.Parse(dateFormat, lresetStr)
		if err != nil {
			return fmt.Errorf("time.Parse(%s): %s", lresetStr, err)
		}
		if !datesAreEqual(now, lrTime) {
			doReset = true
		}
	}
	if !found || doReset {
		if err := zc.ResetZones(numZones); err != nil {
			return err
		}
		if err := kv.Set(LastZoneResetDateKey, now.Format(dateFormat)); err != nil {
			return err
		}
	}

	return nil
}

// updateStateAndVWC updates both the state of zone znum to Complete and the
// VWC to vwc. If either action cannot be performed, restores the original
// state and returns error.
func updateStateAndVWC(zc ZoneController, kv KVStore, znum int, vwc float64) error {
	prevState, err := zc.State(znum)
	if err != nil {
		return err
	}
	err = zc.SetState(znum, Complete)
	if err != nil {
		return err
	}
	err = SetVWC(kv, znum, vwc)
	if err != nil {
		// This could also fail, but not much we can do. Zone will be stuck in
		// Complete state until the next day, but we have other problems to
		// worry about if this happens.
		zc.SetState(znum, prevState)
		return err
	}

	return nil
}

// vwcKey returns the KV store key for VWC for the given zone number.
func vwcKey(znum int) string {
	return CurrentVWCKey + fmt.Sprintf("%d", znum)
}

// GetVWC returns the VWC for the given zone. It returns 0 if the value is not
// found in the KV store.
func GetVWC(kv KVStore, znum int) (float64, error) {
	vwcStr, ok, err := kv.Get(vwcKey(znum))
	if err != nil {
		return 0.0, fmt.Errorf("Get(CurrentVWC) zone %d: %s", znum, err)
	}
	if !ok {
		return 0.0, nil
	}
	f64, err := strconv.ParseFloat(vwcStr, 32)
	if err != nil {
		return 0.0, fmt.Errorf("Get(CurrentVWC) zone %d value %s: %s", znum, vwcStr, err)
	}
	return float64(f64), nil
}

// SetVWC sets the VWC for the given zone number to val.
func SetVWC(kv KVStore, znum int, val float64) error {
	return kv.Set(vwcKey(znum), fmt.Sprint(val))
}

// datesAreEqual reports whether the date components of t1 and t2 are equal.
func datesAreEqual(t1, t2 time.Time) bool {
	return t1.Year() == t2.Year() && t1.YearDay() == t2.YearDay()
}

// tooEarly returns true if now is before runtime.
func tooEarly(now, runtime time.Time) bool {
	nH, nM, nS := now.Clock()
	rH, rM, rS := runtime.Clock()
	nT := nH*3600 + nM*60 + nS
	rT := rH*3600 + rM*60 + rS

	return nT < rT
}

func yesterday(t time.Time) time.Time {
	return t.AddDate(0, 0, -1)
}
