package control

import (
	"fmt"
	"os/exec"
	"strings"
)

// ValveController is a valve controller.
type ValveController interface {
	// OpenValve opens valve number n.
	OpenValve(n int) error
	// CloseValve closes valve number n.
	CloseValve(n int) error
	// CloseAllValves closes all valves.
	CloseAllValves() error
}

const (
	MaxRain8Valves = 8
)

func NewRain8ValveController() *Rain8ValveController {
	return &Rain8ValveController{
		numValves: MaxRain8Valves,
	}
}

type Rain8ValveController struct {
	numValves int
}

func (*Rain8ValveController) OpenValve(n int) error {
	return runRain8Command(n, true)
}

func (*Rain8ValveController) CloseValve(n int) error {
	return runRain8Command(n, false)
}

func (r *Rain8ValveController) CloseAllValves() error {
	var ret error
	for n := 0; n < r.numValves; n++ {
		if err := r.CloseValve(n); err != nil {
			ret = err
		}
	}
	return ret
}

func runRain8Command(num int, on bool) error {
	onStr := "off"
	if on {
		onStr = "on"
	}
	cmdStr := fmt.Sprintf("/usr/local/bin/Rain8Net -v -d \"/dev/ttyUSB0\" -c %d -u 1 -z %s 2>&1", num, onStr)
	outB, err := exec.Command(cmdStr).Output()
	if err != nil {
		return err
	}
	out := string(outB)
	switch {
	case strings.Contains(out, "OK"):
		return nil
	case strings.Contains(out, "FAIL"):
		return fmt.Errorf("%s retured FAIL", cmdStr)
	}
	return fmt.Errorf("%s retured error: %s", cmdStr, err)
}

func NewConsoleValveController(log Logger) *ConsoleValveController {
	return &ConsoleValveController{
		numValves: MaxRain8Valves,
		log:       log,
	}
}

type ConsoleValveController struct {
	numValves int
	log       Logger
}

func (c *ConsoleValveController) OpenValve(n int) error {
	c.log.Infof("OpenValve %d.", n)
	return nil
}

func (c *ConsoleValveController) CloseValve(n int) error {
	c.log.Infof("CloseValve %d.", n)
	return nil
}

func (c *ConsoleValveController) CloseAllValves() error {
	var ret error
	for n := 0; n < c.numValves; n++ {
		if err := c.CloseValve(n); err != nil {
			ret = err
		}
	}
	return ret
}
