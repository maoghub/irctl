package control

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

/*
To add a new valve controller named FooController:
1. The drivers are subdirs of driverDirPath with the name of the driver being the
   subdir name.
2. Each subdir must contain "zone_on", "zone_off" and "zone_all_off" exectuable e.g.
     ../../drivers/rain8/zone_on /dev/ttyUSB0 0 10
   This command runs the rain8 zone on command for zone 0 for 10 minutes, with the
   controller at serial port /dev/ttyUSB.
3. Commands must return 0 for success and non-zero for failure. The output of the
   command  is the command response or error code, if appropriate.
*/

const (
	// onCommandMaxRetries is the maximum retries for an on command.
	// Off commands loop forever on failure.
	onCommandMaxRetries = 5
	// commandRetryInterval is the time to sleep between command retries.
	commandRetryInterval = 10 * time.Second
)

var (
	// driverDirPath is the relative path of the root dir to the
	// controller drivers.
	driverDirPath = filepath.Join(os.Getenv("GOPATH"), "src/irctl/drivers/")
)

// ValveController is a valve controller.
type ValveController interface {
	// OpenValve opens valve number n.
	OpenValve(n int) error
	// CloseValve closes valve number n.
	CloseValve(n int) error
	// CloseAllValves closes all valves.
	CloseAllValves() error
	// NumValves returns the number of valves supported by the controller.
	NumValves() int
}

// NewValveController returns an instance of ValveController with the given
// name if a driver with that name exists.
func NewValveController(controllerName, portName string, log Logger) (ValveController, error) {
	ac, err := AvailableControllerNames()
	if err != nil {
		return nil, err
	}
	if isInStringSlice(ac, controllerName) {
		return NewPhysicalValveController(controllerName, portName, log), nil
	}
	return nil, fmt.Errorf("unknown controller driver %s, choices are %v", controllerName, ac)
}

// AvailableControllerNames returns the names of all available controllers.
func AvailableControllerNames() ([]string, error) {
	files, err := ioutil.ReadDir(driverDirPath)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, subdir := range files {
		out = append(out, subdir.Name())
	}
	return out, nil
}

// PhysicalValveController is a Rain8 valve controller.
type PhysicalValveController struct {
	driverDir string
	portName  string
	numValves int
	log       Logger
}

// NewPhysicalValveController returns a new PhysicalValveController.
func NewPhysicalValveController(driverDir, portName string, log Logger) ValveController {
	return &PhysicalValveController{
		driverDir: driverDir,
		portName:  portName,
		numValves: 8,
		log:       log,
	}
}

// OpenValve implements ValveController method.
func (vc *PhysicalValveController) OpenValve(n int) error {
	return vc.valveCommand("zone_on", n, onCommandMaxRetries)
}

// CloseValve implements ValveController method.
func (vc *PhysicalValveController) CloseValve(n int) error {
	return vc.valveCommand("zone_off", n, 0 /*retry forever*/)
}

// CloseAllValves implements ValveController method.
func (vc *PhysicalValveController) CloseAllValves() error {
	return vc.valveCommand("zone_all_off", 0, 0 /*retry forever*/)
}

// valveCommand issues the given command to vc for repeated number of times (or forever).
func (vc *PhysicalValveController) valveCommand(cmdStr string, zoneNum, repeat int) error {
	cmd := fmt.Sprintf("%s %s %d", filepath.Join(driverDirPath, vc.driverDir, cmdStr), vc.portName, zoneNum)
	out := ""
	for i := 0; i < repeat || repeat == 0; i++ {
		args := strings.Split(cmd, " ")
		outB, err := exec.Command(args[0], args[1:]...).Output()
		if err == nil {
			return nil
		}
		out = string(outB)
		vc.log.Errorf(out)
		time.Sleep(commandRetryInterval)
	}
	return errors.New(out)
}

// NumValves implements ValveController method.
func (vc *PhysicalValveController) NumValves() int {
	return vc.numValves
}

func isInStringSlice(ss []string, v string) bool {
	for _, s := range ss {
		if s == v {
			return true
		}
	}
	return false
}
