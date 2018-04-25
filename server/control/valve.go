package control

import (
	"fmt"
	"io/ioutil"
	"log"
	"os/exec"
	"strings"
	"time"
)

/*
To add a new valve controller named FooController:
  1. Add method implementations of ValveController for FooController.
  2. Add "foo": NewFooController entry to the controllerFactories map.
See the comment lines beginning with // ADD:
*/

const (
	commandMaxRetries    = 5
	commandRetryInterval = 10 * time.Second
	// rain8Command is the serial command that controls the zones.
	rain8Command  = "Rain8Net"
	driverDirPath = "../"
)

// NewValveController returns an instance of ValveController with the given
// name if a driver with that name exists.
func NewValveController(controllerName string, log Logger) (ValveController, error) {
	switch controllerName {
	case "console":
		return NewConsoleValveController(log), nil
	case "rain8", "numato":
		return NewPhysicalValveController(controllerName, log), nil
	}
	return nil, fmt.Errorf("unknown controller driver %s", controllerName)
}

// AvailableControllerNames returns the names of all available controllers.
func AvailableControllerNames() []string {
	files, err := ioutil.ReadDir(".")
	if err != nil {
		log.Fatal(err)
	}
	var out []string
	for k := range controllerFactories {
		out = append(out, k)
	}
	return out
}

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

// NewPhysicalValveController returns a new PhysicalValveController.
func NewPhysicalValveController(driverDir string, log Logger) ValveController {
	return &PhysicalValveController{
		driverDir: driverDir,
		numValves: 8,
		log:       log,
	}
}

// PhysicalValveController is a Rain8 valve controller.
type PhysicalValveController struct {
	driverDir string
	numValves int
	log       Logger
}

// OpenValve implements ValveController method.
func (*PhysicalValveController) OpenValve(n int) error {
	return runRain8Command(n, true)
}

// CloseValve implements ValveController method.
func (*PhysicalValveController) CloseValve(n int) error {
	return runRain8Command(n, false)
}

// CloseAllValves implements ValveController method.
func (r *Rain8ValveController) CloseAllValves() error {
	cmdStr := fmt.Sprintf(`%s -v -c alloff -u 1`, rain8Command)
	args := strings.Split(cmdStr, " ")
	outB, _ := exec.Command(args[0], args[1:]...).Output()
	out := string(outB)
	switch {
	case strings.Contains(out, "SUCCESS"):
		return nil
	case strings.Contains(out, "FAIL"):
		return fmt.Errorf("%s", out)
	}
	r.log.Errorf("Unknown response to %s:%s", cmdStr, out)
	return nil
}

// NumValves implements ValveController method.
func (r *PhysicalValveController) NumValves() int {
	return r.numValves
}

// runRain8Command turns on or off the given valve number, depending on the
// value of on.
func runRain8Command(num int, on bool) error {
	onStr := "off"
	if on {
		onStr = "on"
	}
	var err error
	cmdStr := fmt.Sprintf(`%s -v -c %s -u 1 -z %d`, rain8Command, onStr, num+1)
	args := strings.Split(cmdStr, " ")
	for i := 0; i < commandMaxRetries; i++ {
		outB, _ := exec.Command(args[0], args[1:]...).Output()
		out := string(outB)
		switch {
		case strings.Contains(out, "SUCCESS"):
			return nil
		case strings.Contains(out, "FAIL"):
			err = fmt.Errorf("%s", out)
		}
		time.Sleep(commandRetryInterval)

	}
	return fmt.Errorf("%s retured error after %d retries: %s", cmdStr, commandMaxRetries, err)
}

// NewConsoleValveController returns a new ConsoleValveController.
func NewConsoleValveController(log Logger) ValveController {
	return &ConsoleValveController{
		numValves: 8,
		log:       log,
	}
}

// ConsoleValveController is a Rain8 valve controller. It simply prints the
// valve commands to the log.
type ConsoleValveController struct {
	numValves int
	log       Logger
}

// OpenValve implements ValveController method.
func (c *ConsoleValveController) OpenValve(n int) error {
	c.log.Infof("OpenValve %d.", n)
	return nil
}

// CloseValve implements ValveController method.
func (c *ConsoleValveController) CloseValve(n int) error {
	c.log.Infof("CloseValve %d.", n)
	return nil
}

// CloseAllValves implements ValveController method.
func (c *ConsoleValveController) CloseAllValves() error {
	c.log.Infof("CloseAllValves.")
	return nil
}

// NumValves implements ValveController method.
func (c *ConsoleValveController) NumValves() int {
	return c.numValves
}

/* ADD: to add a new controller type Foo, implement the methods below and
        add to controllerFactories map.

// NewFooValveController returns a new FooValveController.
func NewFooValveController(log Logger) ValveController {
	return &FooValveController{
		numValves: 8,
		log:       log,
	}
}

// FooValveController is a Rain8 valve controller. It simply prints the
// valve commands to the log.
type FooValveController struct {
	numValves int
	log       Logger
}

// OpenValve implements ValveController method.
func (c *FooValveController) OpenValve(n int) error {
	c.log.Infof("OpenValve %d.", n)
	return nil
}

// CloseValve implements ValveController method.
func (c *FooValveController) CloseValve(n int) error {
	c.log.Infof("CloseValve %d.", n)
	return nil
}

// CloseAllValves implements ValveController method.
func (c *FooValveController) CloseAllValves() error {
	var ret error
	for n := 0; n < c.numValves; n++ {
		if err := c.CloseValve(n); err != nil {
			ret = err
		}
	}
	return ret
}

// NumValves implements ValveController method.
func (c *FooValveController) NumValves() int {
	return c.numValves
}
*/
