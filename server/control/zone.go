package control

import (
	"fmt"
	"time"

	log "github.com/golang/glog"
)

// ZoneState is the state of the zone. The state machine is as follows:
// Idle - initial state
type ZoneState string

const (
	// Unknown is an unknown state.
	Unknown  ZoneState = "Unknown"
	// Idle is the idle state.
	Idle     ZoneState = "Idle"
	// Running is the running state.
	Running  ZoneState = "Running"
	// Complete is the completed state.
	Complete ZoneState = "Complete"
)

// ZoneController is a controller of a zone.
type ZoneController struct {
	vc ValveController
	kv KVStore
}

// NewZoneController returns a ptr to an intialized ZoneController.
func NewZoneController(vc ValveController, kv KVStore) *ZoneController {
	return &ZoneController{
		vc: vc,
		kv: kv,
	}
}

// State reports the state of the zone without affecting the valve.
func (zc *ZoneController) State(n int) (ZoneState, error) {
	s, ok, err := zc.kv.Get(zc.zoneKey(n))
	if err != nil {
		return Unknown, fmt.Errorf("Get(ZoneState) num %d: %s", n, err)
	}
	if !ok {
		return Idle, nil
	}
	return ZoneState(s), nil
}

// SetState sets the state of the zone without affecting the valve.
func (zc *ZoneController) SetState(n int, zs ZoneState) error {
	err := zc.kv.Set(zc.zoneKey(n), string(zs))
	if err != nil {
		return fmt.Errorf("Set(ZoneState) num %d to %s: %s", n, zs, err)
	}
	return nil
}

// ResetZones sets any zone currently in Complete state to Idle state.
// numZones is the number of zones controlled.
func (zc *ZoneController) ResetZones(numZones int) error {
	for n := 0; n < numZones; n++ {
		s, err := zc.State(n)
		if err != nil {
			return err
		}
		if s == Complete {
			if err := zc.SetState(n, Idle); err != nil {
				return err
			}
		}
	}

	return nil
}

// Run runs zone number n for duration d.
// This comprises:
//   1. updating state to Running + opening valve number n
//   2. sleeping for duration d
//   3. closing valve number n and updating state to Complete.
// If dontSleep is set, it skips step 2.
func (zc *ZoneController) Run(n int, d time.Duration, dontSleep bool) error {
	log.Infof("RunZone %d for %d mins.", n, int(d.Minutes()))
	if err := zc.TurnOn(n); err != nil {
		return err
	}
	if !dontSleep {
		time.Sleep(d)
	}
	return zc.TurnOff(n)
}

// TurnOn sets the zone state n to Running and opens valve n.
func (zc *ZoneController) TurnOn(n int) error {
	err := zc.SetState(n, Running)
	if err != nil {
		return err
	}
	err = zc.vc.OpenValve(n)
	if err != nil {
		_ = zc.SetState(n, Unknown)
		return fmt.Errorf("OpenValve %d: %s", n, err)
	}
	return nil
}

// TurnOff closes valve n and sets zone state to Complete.
func (zc *ZoneController) TurnOff(n int) error {
	err := zc.vc.CloseValve(n)
	if err != nil {
		return fmt.Errorf("CloseValve %d: %s", n, err)
	}
	err = zc.SetState(n, Complete)
	if err != nil {
		return err
	}
	return nil
}

// TurnAllOff closes all valves (up to maxPossibleValves for the controller)
// without modifying the zone state. it is used to override any glitches in the
// physical controller which may cause a valve to be stuck in open state.
func (zc *ZoneController) TurnAllOff() error {
	return zc.vc.CloseAllValves()
}

// zoneKey returns the key for zone n to be used in a KV store.
func (zc *ZoneController) zoneKey(n int) string {
	return fmt.Sprintf("%s%d", ZoneStateKey, n)
}
