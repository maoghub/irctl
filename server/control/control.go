// package control contains the logic for the control run loop. A run loop is
// an execution of the run algorithm based on the state saved in the KV store.
// In general, most run loops will exit immediately with no work to do.
// If the current time is later than the start time, RunOnce will check whether
// the loop successfully ran to completion today already and if so, exit.
// Otherwise, RunOnce will check conditions, compute the runtimes for each
// zone and run each zone in turn, if that zone has not already been run.
// This is done to avoid repeatedly running zones in case of a crash.
package control

import (
	"fmt"
	"io/ioutil"
	"strconv"
	"time"

	"irctl/server/control/weather"

	log "github.com/golang/glog"
	"github.com/kylelemons/godebug/pretty"
)

const (
	// runInterval is the interval between run loops.
	runInterval = 60 * time.Minute
	// dateFormat is the string format for dates.
	dateFormat = "2006-Jan-02"
	// timeOfDayFormat is the string format for time of day.
	timeOfDayFormat = "15:04"
)

var (
	// CommandRunning reports whether a manual or auto command is currently
	// running. It should be set to true under lock before commencing an
	// operation that can turn on a valve.
	// Note this can race with HTTP handler for running zone manually but
	// due to lack of CanLock functionality in sync.Mutex making this race
	// free would be more trouble than it's worth.
	CommandRunning = false
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

// Keys for KVStore.
const (
	ZoneStateKey   = "ZoneState"
	LastRunDateKey = "LastRunDate"
	CurrentVWCKey  = "CurrentVWC"
)

// Run repeatedly runs the entire action, with a sleep interval of runInterval.
// It uses:
//   kv to persist run state
//   cg to get current conditions
//   zc to control zones
//   er to report errors
// Never exits.
func Run(rparam *RunParams, kv KVStore, cg weather.ConditionsGetter, zc ZoneController, er ErrorReporter) {
	log.Infof("control.Run called with \n%v\nKV store (%T), ConditionsGetter(%T), ZoneController(%T), ErrorReporter(%T))",
		pretty.Sprint(*rparam), kv, cg, zc, er)
	ctrl := NewController(rparam, kv, cg, zc, er)
	for {
		if _, err := ctrl.RunOnce(time.Now()); err != nil {
			er.Report(err)
		}
		time.Sleep(runInterval)
	}
}

// Controller is the top level irrigation controller.
type Controller struct {
	rparam           *RunParams
	systemConfig     *SystemConfig
	algorithm        ETAlgorithm
	kvStore          KVStore
	conditionsGetter weather.ConditionsGetter
	zoneController   ZoneController
	dataLogger       *DataLogger
	errorReporter    ErrorReporter
}

// NewController creates an initialized Controller and returns a pointer to it.
func NewController(rparam *RunParams, kv KVStore, cg weather.ConditionsGetter, zc ZoneController, er ErrorReporter) *Controller {
	return &Controller{
		rparam:           rparam,
		kvStore:          kv,
		conditionsGetter: cg,
		zoneController:   zc,
		errorReporter:    er,
	}
}

// RunOnce runs the entire loop once. It returns a bool to indicate whether
// the loop was run, and an error code. The loop is not run either if it has
// already completed today, or is not yet scheduled to run.
// It uses:
//   kv to persist state
//   cg to get current conditions
//   zc to control zones
//   er to report errors
//
// The zone state transitions are Idle->Running->Complete->Idle.
// Complete means the zone has run today. If all zones run successfully,
// alreadyRan is set, otherwise, the loop attempts to run any zones
// that are not Complete.
// Once alreadyRan is set, all Zones are reset from Complete to
// Idle. Zones can only go to Running from Idle state.
// All state is stored in the KV store. If there's a crash when a zone is
// running, upon restart its state is changed from Running to Complete.
func (c *Controller) RunOnce(now time.Time) (bool, error) {
	log.Infof("RunOnce at time %s.", now.Format("Mon 2 Jan 2006 15:04"))

	if CommandRunning {
		log.Infof("Manual command is running, will retry later.")
		return false, nil
	}

	// Close all valves directly on the valve controller for safety/recovery.
	// Nothing should be running at this point in the loop.
	c.zoneController.TurnAllOff()

	var err error
	c.systemConfig, c.algorithm, err = readConfig(c.rparam)
	if err != nil {
		// can't do anything without a config, return and try again.
		return false, err
	}
	log.Infof("Read config from %s.", c.rparam.ConfigPath)

	c.dataLogger = NewDataLogger(c.rparam.DataLogPath)

	// alreadyRan will be true only if ALL zones were successfully completed.
	if alreadyRan, err := checkIfRanToday(c.kvStore, now); alreadyRan || err != nil {
		// Since all ran successfully, transition states from Complete to Idle.
		if err := c.zoneController.ResetZones(c.systemConfig.NumZones()); err != nil {
			// If this fails, zones will not be able to run.
			log.Error(err)
		}
		// This is to show the predicted runtimes for tomorrow in the web UI. The times will be
		// recalculated based on the most accurate conditions before they are run, so the actual
		// runtimes may differ. This prediction can only be done after VWC is updated after
		// today's run.
		_, _, tempForecast, precipForecast := c.getConditions(now)
		tomorrowRuntimes, err := c.calculateRuntimes(tempForecast, precipForecast, 0.0, now)
		if err != nil {
			log.Error(err)
		} else if err := c.dataLogger.WriteRuntimes(tomorrow(now), c.systemConfig.NumZones(), tomorrowRuntimes); err != nil {
			log.Error(err)
		}
		log.Infof("Already ran today is %v.", alreadyRan)
		return alreadyRan, err
	}

	// If current time is before scheduled run time, exit.
	log.Infof("Current time is %s, scheduled time is %s.", now.Format(timeOfDayFormat), c.systemConfig.GlobalConfig.RunTimeAM.Format(timeOfDayFormat))
	if tooEarly(now, c.systemConfig.GlobalConfig.RunTimeAM) {
		return false, nil
	}

	tempYesterday, precipYesterday, _, precipForecast := c.getConditions(now)
	runtimes, err := c.calculateRuntimes(tempYesterday, precipYesterday, precipForecast, now)
	if err != nil {
		return false, err
	}

	// Returns success only if ALL zones ran correctly. If not, runtimes and ran today will not
	// be updated and run loop will attempt to re-run any remaining zones.
	if err := c.runZones(runtimes); err != nil {
		return false, err
	}

	log.Infof("Writing runtimes.")
	if err := c.dataLogger.WriteRuntimes(now, c.systemConfig.NumZones(), runtimes); err != nil {
		// If this fails, run times will simply not appear on the web UI.
		c.errorReporter.Report(err)
	}

	log.Infof("Updating last run time.")
	// This causes alreadyRan to be true for the next time the loop runs.
	if err := c.kvStore.Set(LastRunDateKey, now.Format(dateFormat)); err != nil {
		c.errorReporter.Report(err)
	}

	return true, nil
}

// getConditions repeatedly tries to get current and forecast conditions. If it is unsuccessful
// it returns the most recent past conditions read from the data log. If data log can't be read,
// it returns a "reasonable" value.
func (c *Controller) getConditions(now time.Time) (tempY, precipY, tempT, precipT float64) {
	log.Infof("Getting conditions.")
	iy, ty, py, err := c.conditionsGetter.GetYesterday(c.systemConfig.GlobalConfig.AirportCode)
	for retries := 10; err != nil && retries > 0; retries-- {
		time.Sleep(time.Minute)
		iy, ty, py, err = c.conditionsGetter.GetYesterday(c.systemConfig.GlobalConfig.AirportCode)
		if err != nil {
			log.Error(err)
		}
	}
	if err != nil {
		// Can't get online conditions, use most recent available conditions.
		c.errorReporter.Report(err)
		ty, py = c.dataLogger.ReadMostRecentConditions(now)
	} else {
		if err := c.dataLogger.WriteConditions(yesterday(now), iy, ty, py); err != nil {
			c.errorReporter.Report(err)
		}
	}
	icf, tf, pf, ict, tt, pt, err := c.conditionsGetter.GetForecast(c.systemConfig.GlobalConfig.AirportCode)
	for retries := 10; err != nil && retries > 0; retries-- {
		time.Sleep(time.Minute)
		icf, tf, pf, ict, tt, pt, err = c.conditionsGetter.GetForecast(c.systemConfig.GlobalConfig.AirportCode)
	}
	if err != nil {
		// Can't get forecast, use yesterday's conditions.
		icf, tf, pf = iy, ty, py
		c.errorReporter.Report(err)
	} else {
		if err := c.dataLogger.WriteConditions(now, icf, tf, pf); err != nil {
			c.errorReporter.Report(err)
		}
		if err := c.dataLogger.WriteConditions(tomorrow(now), ict, tt, pt); err != nil {
			c.errorReporter.Report(err)
		}
	}

	log.Infof("Yesterday: %s %3.1f degF / %1.1f In, Forecast: %s /  %3.1f degF / %1.1f In", iy, ty, py, icf, tf, pf)
	return ty, py, tf, pf
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
	log.Infof("runZones with %d zones.", c.systemConfig.NumZones())
	CommandRunning = true
	for znum := 0; znum < c.systemConfig.NumZones(); znum++ {
		runtime, ok := runtimes[znum]
		if !ok {
			continue
		}
		z, ok := c.systemConfig.ZoneConfigs[znum]
		if !ok {
			log.Infof("Zone %d not in config, skip.", znum)
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
	CommandRunning = false
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

func tomorrow(t time.Time) time.Time {
	return t.AddDate(0, 0, 1)
}
