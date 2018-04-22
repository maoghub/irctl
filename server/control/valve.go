package control

import (
	"fmt"
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
	rain8MaxRetries    = 5
	rain8RetryInterval = 10 * time.Second
	// rain8Command is the serial command that controls the zones.
	rain8Command = "Rain8Net"
)

// NewValveController returns an instance of ValveController with the given
// name if a driver with that name exists.
func NewValveController(controllerName string, log Logger) (ValveController, error) {
	vcf, ok := controllerFactories[controllerName]
	if !ok {
		return nil, fmt.Errorf("%s is not a valid controller name, available options are %v", controllerName, AvailableControllerNames())
	}
	return vcf(log), nil
}

// controllerFactory is a factory for creating ValveControllers.
type controllerFactory func(log Logger) ValveController

var (
	// controllerFactories is a map of available controller factories. This map
	// must be updated when adding a new controller.
	controllerFactories = map[string]controllerFactory{
		"console": NewConsoleValveController,
		"rain8":   NewRain8ValveController,
		// ADD: "foo" : NewFooController,
	}
)

// AvailableControllerNames returns the names of all available controllers.
func AvailableControllerNames() []string {
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

// NewRain8ValveController returns a new Rain8ValveController.
func NewRain8ValveController(log Logger) ValveController {
	return &Rain8ValveController{
		numValves: 8,
		log:       log,
	}
}

// Rain8ValveController is a Rain8 valve controller.
type Rain8ValveController struct {
	numValves int
	log       Logger
}

// OpenValve implements ValveController method.
func (*Rain8ValveController) OpenValve(n int) error {
	return runRain8Command(n, true)
}

// CloseValve implements ValveController method.
func (*Rain8ValveController) CloseValve(n int) error {
	return runRain8Command(n, false)
}

// CloseAllValves implements ValveController method.
func (r *Rain8ValveController) CloseAllValves() error {
	var ret error
	for n := 0; n < r.numValves; n++ {
		if err := r.CloseValve(n); err != nil {
			ret = err
		}
	}
	return ret
}

// NumValves implements ValveController method.
func (r *Rain8ValveController) NumValves() int {
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
	cmdStr := fmt.Sprintf("%s -v -d \"/dev/ttyUSB0\" -c %d -u 1 -z %s 2>&1", rain8Command, num, onStr)
	args := strings.Split(cmdStr, " ")
	for i := 0; i < rain8MaxRetries; i++ {
		outB, err := exec.Command(args[0], args[1:]...).Output()
		if err != nil {
			return err
		}
		out := string(outB)
		switch {
		case strings.Contains(out, "OK"):
			return nil
		case strings.Contains(out, "FAIL"):
			err = fmt.Errorf("%s", out)
		}
	}
	return fmt.Errorf("%s retured error after $=%d retries: %s", cmdStr, rain8MaxRetries, err)
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
