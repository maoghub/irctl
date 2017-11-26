package control

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"
)

type TestErrorReporter struct {
	Err error
}

func (r *TestErrorReporter) Report(err error) error {
	r.Err = err
	return err
}

type TestLogger struct {
	log []string
}

func (tl *TestLogger) Debugf(doLog bool, s string, p ...interface{}) {
	tl.log = append(tl.log, "DEBUG: "+fmt.Sprintf(s, p...))
}

func (tl *TestLogger) Infof(s string, p ...interface{}) {
	tl.log = append(tl.log, "INFO: "+fmt.Sprintf(s, p...))
}

func (tl *TestLogger) Errorf(s string, p ...interface{}) {
	tl.log = append(tl.log, "ERROR: "+fmt.Sprintf(s, p...))
}

func (tl *TestLogger) Contents() string {
	return strings.Join(tl.log, "\n")
}

type TestConditionsGetter struct {
	YesterdayIcon     string
	YesterdayTempF    float64
	YesterdayPrecipIn float64
	ForecastIcon      string
	ForecastTempF     float64
	ForecastPrecipIn  float64
}

func (w *TestConditionsGetter) GetForecast(airportCode string) (icon string, tempF float64, precipIn float64, err error) {
	return w.YesterdayIcon, w.YesterdayTempF, w.YesterdayPrecipIn, nil
}
func (w *TestConditionsGetter) GetYesterday(airportCode string) (icon string, tempF float64, precipIn float64, err error) {
	return w.ForecastIcon, w.ForecastTempF, w.ForecastPrecipIn, nil
}

type ValveOperation struct {
	num    int
	doOpen bool
}

type TestValveController struct {
	ops []ValveOperation
	log Logger
}

func (t *TestValveController) OpenValve(n int) error {
	t.log.Infof("OpenValve %d.", n)
	t.ops = append(t.ops, ValveOperation{n, true})
	return nil
}

func (t *TestValveController) CloseValve(n int) error {
	t.log.Infof("CloseValve %d.", n)
	t.ops = append(t.ops, ValveOperation{n, false})
	return nil
}

func (t *TestValveController) ValvesRan(numValves int) ([]bool, error) {
	var errs []string
	didOpen := make(map[int]bool)
	didClose := make(map[int]bool)

	for _, v := range t.ops {
		switch v.doOpen {
		case true:
			if didOpen[v.num] {
				errs = append(errs, fmt.Sprintf("valve %d was opened more than once", v.num))
			}
			if didClose[v.num] {
				errs = append(errs, fmt.Sprintf("valve %d was opened after it was closed", v.num))
			}
			didOpen[v.num] = true
		case false:
			if !didOpen[v.num] {
				errs = append(errs, fmt.Sprintf("valve %d was closed before it was opened", v.num))
			}
			if didClose[v.num] {
				errs = append(errs, fmt.Sprintf("valve %d was closed more than once", v.num))
			}
			didClose[v.num] = true
		}
	}

	didRun := make([]bool, numValves)
	for k := range didOpen {
		if !didClose[k] {
			errs = append(errs, fmt.Sprintf("valve %d was opened but not closed", k))
		}
		didRun[k] = true
	}

	if errs == nil {
		return didRun, nil
	}
	return didRun, fmt.Errorf("%s", strings.Join(errs, "\n"))
}

func getState(zc ZoneController, numZones int) (vwc []float64, zoneState []ZoneState) {
	for z := 0; z < numZones; z++ {
		v, _ := GetVWC(zc.kv, z)
		vwc = append(vwc, v)
	}
	for z := 0; z < numZones; z++ {
		s, _ := zc.State(z)
		zoneState = append(zoneState, s)
	}
	return
}

func setState(zc ZoneController, vwc []float64, zoneState []ZoneState) {
	for z, v := range vwc {
		SetVWC(zc.kv, z, v)
	}
	for z, s := range zoneState {
		zc.SetState(z, s)
	}
}

func TestRunOnce(t *testing.T) {
	testConfig := `
GLOBAL_CONFIG,KSJC,0,9:00,16:00,0
#ZONE,number,name,run,rain,soil_name,min_moist_pct,max_moist_pct,run_time_mult,root_depth,et_rate
ZONE,0,zone 0,1,1,Loam,10,20,1.0,8.0,1.0
ZONE,1,zone 1,1,1,Loam,10,20,2.0,16.0,1.0
SOIL,Loam,40.0	
ALGORITHM,-50,25,50-65,50,65-75,75,75-,100
`
	tests := []struct {
		desc                  string
		timeStr               string
		condGetter            ConditionsGetter
		startVWC              []float64
		startState            []ZoneState
		wantDidRun            bool
		wantErr               string
		wantEndVWC            []float64
		wantEndState          []ZoneState
		wantValvesRan         []bool
		wantValveControlError string
		wantLog               string
	}{
		{
			desc:          "too early",
			timeStr:       "7:00am",
			condGetter:    &TestConditionsGetter{"test", 80, 0, "test", 80, 0},
			startVWC:      []float64{10, 15},
			startState:    []ZoneState{Idle, Idle},
			wantDidRun:    false,
			wantEndVWC:    []float64{10, 15},
			wantEndState:  []ZoneState{Idle, Idle},
			wantValvesRan: []bool{false, false},
		},
		{
			desc:          "run zone 0, update zone 1",
			timeStr:       "10:00am",
			condGetter:    &TestConditionsGetter{"test", 80, 0, "test", 80, 0},
			startVWC:      []float64{10, 15},
			startState:    []ZoneState{Idle, Idle},
			wantDidRun:    true,
			wantEndVWC:    []float64{20, 10},
			wantEndState:  []ZoneState{Complete, Complete},
			wantValvesRan: []bool{true, false},
		},
		{
			desc:          "run zone 0, zone 1 complete",
			timeStr:       "10:00am",
			condGetter:    &TestConditionsGetter{"test", 80, 0, "test", 80, 0},
			startVWC:      []float64{10, 15},
			startState:    []ZoneState{Idle, Complete},
			wantDidRun:    true,
			wantEndVWC:    []float64{20, 15},
			wantEndState:  []ZoneState{Complete, Complete},
			wantValvesRan: []bool{true, false},
		},
		{
			desc:                  "run zone0, update zone1 (already running)",
			timeStr:               "10:00am",
			condGetter:            &TestConditionsGetter{"test", 80, 0, "test", 80, 0},
			startVWC:              []float64{10, 15},
			startState:            []ZoneState{Idle, Running},
			wantDidRun:            true,
			wantEndVWC:            []float64{20, 10},
			wantEndState:          []ZoneState{Complete, Complete},
			wantValvesRan:         []bool{true, false},
			wantValveControlError: `valve 1 was closed before it was opened`,
		},
	}

	for _, tt := range tests {
		kv := NewTestKVStore()
		er := &TestErrorReporter{}
		log := &TestLogger{}
		tcg := &TestConditionsGetter{"test", 80, 0, "test", 80, 0}
		tvc := &TestValveController{log: log}
		zc := *NewZoneController(tvc, kv, log)
		now, _ := time.Parse("3:04pm", tt.timeStr)

		kv.Set(LastZoneResetDateKey, now.Format(dateFormat))
		setState(zc, tt.startVWC, tt.startState)

		didRun, err := RunOnce(&RunParams{config: testConfig, logDebug: true, dontSleep: true}, kv, tcg, zc, er, log, now)
		t.Log(tt.desc + "\n" + log.Contents())

		if got, want := didRun, tt.wantDidRun; got != want {
			t.Errorf("%s: got didRun %t, want didRun: %t", tt.desc, got, want)
			continue
		}
		if tt.wantDidRun == false {
			continue
		}

		if got, want := errToString(err), tt.wantErr; got != want {
			t.Errorf("%s: got error %s, want error: %s", tt.desc, got, want)
			continue
		}
		if tt.wantErr != "" {
			continue
		}

		numValves := len(tt.startState)
		gotVWC, gotState := getState(zc, numValves)
		if got, want := gotVWC, tt.wantEndVWC; !reflect.DeepEqual(got, want) {
			t.Errorf("%s final VWC: got: %v, want: %v", tt.desc, got, want)
		}
		if got, want := gotState, tt.wantEndState; !reflect.DeepEqual(got, want) {
			t.Errorf("%s final State: got: %v, want: %v", tt.desc, got, want)
		}

		gotValvesRan, err := tvc.ValvesRan(numValves)
		if got, want := errToString(err), tt.wantValveControlError; got != want {
			t.Errorf("%d valves ran: got error %s, want error: %s", tt.desc, got, want)
			continue
		}
		if got, want := gotValvesRan, tt.wantValvesRan; !reflect.DeepEqual(got, want) {
			t.Errorf("%s valves ran: got: %v, want: %v", tt.desc, got, want)
		}

		/*		if got, want := strings.Join(log.Contents(), "\n"), tt.want; got != want {
					t.Errorf("%d: got: %s, want: %s", idx, got, want)
					continue
				}
		*/
	}
}
