package control

import (
	"fmt"
	"io/ioutil"
	"strconv"
    "sync"
	"time"

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
	// LogLevel is the log LogVerbosity level.
	LogLevel LogVerbosity
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
//   log to log messages
// Never exits.
func Run(rparam *RunParams, kv KVStore, cg ConditionsGetter, zc ZoneController, er ErrorReporter, log Logger) {
	log.Infof("control.Run called with \n%v\nKV store (%T), ConditionsGetter(%T), ZoneController(%T), ErrorReporter(%T), Logger(%T)", 
		pretty.Sprint(*rparam), kv, cg, zc, er, log)
	for {
		if _, err := RunOnce(rparam, kv, cg, zc, er, log, time.Now()); err != nil {
			er.Report(err)
		}
		time.Sleep(runInterval)
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
//   log to log messages
func RunOnce(rparam *RunParams, kv KVStore, cg ConditionsGetter, zc ZoneController, er ErrorReporter, log Logger, now time.Time) (bool, error) {
	log.Debugf("RunOnce at time %s", now.Format("Mon 2 Jan 2006 15:04"))

	if CommandRunning {
		log.Infof("Manual command is running, will retry later.")
		return false, nil
	}
	
	// Locking excludes manual runs from happening.
	CommandRunningMu.Lock()
	defer CommandRunningMu.Unlock()

	// Every time, if not running manually, close all valves directly on the 
	// valve controller as a safety/recovery measure.
	if err := zc.TurnAllOff(); err != nil {
		return false, nil
	}
	
	if alreadyRan, err := checkIfRanToday(kv, log, now); alreadyRan || err != nil {
		log.Debugf("Already ran today, exiting.")
		return alreadyRan, err
	}

	log.Infof("Reading config from %s.", rparam.ConfigPath)
	sc, alg, err := readConfig(rparam)
	if err != nil {
		return false, err
	}
	log.Infof("Read config from %s.", rparam.ConfigPath)

	// Reset zone states from Complete to Idle once per day.
	if err := resetZones(zc, kv, now, sc.NumZones()); err != nil {
		return false, nil
	}

	// If current time is before scheduled run time, exit.
	log.Debugf("Current time is %s, scheduled time is %s.", now.Format(timeOfDayFormat), sc.GlobalConfig.RunTimeAM.Format(timeOfDayFormat))
	if tooEarly(now, sc.GlobalConfig.RunTimeAM) {
		log.Debugf("Too early, exiting.")
		return false, nil
	}

	log.Infof("Getting conditions.")
	dl := NewDataLogger(log, rparam.DataLogPath)
	// Check conditions.
	iconYesterday, tempYesterday, precipYesterday, err := cg.GetYesterday(sc.GlobalConfig.AirportCode)
	if err != nil {
		return false, err
	}
	if err := dl.WriteConditions(yesterday(now), iconYesterday, tempYesterday, precipYesterday); err != nil {
		er.Report(err)
	}
	iconForecast, tempForecast, precipForecast, err := cg.GetForecast(sc.GlobalConfig.AirportCode)
	if err != nil {
		return false, err
	}
	if err := dl.WriteConditions(now, iconForecast, tempForecast, precipForecast); err != nil {
		er.Report(err)
	}
	log.Infof("Yesterday: %s / %3.1f degF / %1.1f In, Forecast: %s /  %3.1f degF / %1.1f In",
		iconYesterday, tempYesterday, precipYesterday, iconForecast, tempForecast, precipForecast)

	// Zones are in map and not all zones may be defined. Iterate in ascending
	// order for deterministic behavior. If any zone has errors, skip over
	// remaining actions for that zone and continue to the next zone.
	runtimes := make([]float64, sc.NumZones())
	for znum := 0; znum < sc.NumZones(); znum++ {
		z, ok := sc.ZoneConfigs[znum]
		if !ok {
			// zone is not defined in the config.
			continue
		}

		zs, err := zc.State(znum)
		if err != nil {
			er.Report(err)
			continue
		}
		log.Infof("Zone %d state is %s.", znum, zs)
		dontRun := false
		switch zs {
		case Running, Unknown:
			log.Errorf("Zone %d still Running, turning off", znum)
			zc.TurnOff(znum)
			// It's not known how long the zone was running, therefore just
			// shut it off and don't run it any more today.
			dontRun = true
		case Complete:
			continue
		}

		vWC, err := GetVWC(kv, znum)
		if err != nil {
			er.Report(err)
			continue
		}
		newVWC, err := alg.CalculateVWC(Pct(vWC), tempYesterday, precipYesterday, now, z)
		if err != nil {
			er.Report(err)
			continue
		}
		log.Infof("Zone %d VWC: %3.2f -> %3.2f", znum, vWC, newVWC)
		// Check if VWC is below the threshold. If so, run the zone, otherwise
		// just update it to new value.
		if newVWC >= z.MinVWC {
			if err := updateStateAndVWC(zc, kv, znum, float64(newVWC)); err != nil {
				er.Report(err)
				continue
			}
			log.Infof("Update VWC to %3.2f.", newVWC)
		} else {
			runDuration, err := alg.CalculateRuntime(newVWC, z.MaxVWC, precipForecast, z)
			if err != nil {
				er.Report(err)
				continue
			}
			log.Infof("Below minimum of %3.2f.", z.MinVWC)
			if !dontRun {
				err = zc.Run(znum, runDuration, rparam.DontSleep)
				if err != nil {
					er.Report(err)
					continue
				}
				runtimes[znum] = runDuration.Minutes()
			}
			if err := updateStateAndVWC(zc, kv, znum, float64(z.MaxVWC)); err != nil {
				er.Report(err)
				continue
			}
			log.Infof("Set VWC to max %3.2f after run.", z.MaxVWC)
		}
	}

	log.Infof("Writing runtimes.")
	if err := dl.WriteRuntimes(now, runtimes); err != nil {
		return true, er.Report(err)
	}

	log.Infof("Updating last run time.")
	if err := kv.Set(LastRunDateKey, now.Format(dateFormat)); err != nil {
		return true, er.Report(err)
	}

	return true, nil
}

// checkIfRanToday reports whether the action was already run today.
func checkIfRanToday(kv KVStore, log Logger, now time.Time) (bool, error) {
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
		return nil, nil, fmt.Errorf("could not parse config file: %s\n\n%s\n", err, config)
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
		return 0.0, fmt.Errorf("Get(CurrentVWC) zone %d value %s: %s", vwcStr, err)
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
