package control

import (
	"fmt"
	"os/exec"
	"time"
)

// ValveController is a valve controller.
type ValveController interface {
	// OpenValve opens valve number n.
	OpenValve(n int) error
	// CloseValve closes valve number n.
	CloseValve(n int) error
}

func NewRain8ValveController() *Rain8ValveController {
	return &Rain8ValveController{}
}

type Rain8ValveController struct {
}

func (*Rain8ValveController) OpenValve(n int) error {
	return runRain8Command(n, true)
}

func (*Rain8ValveController) CloseValve(n int) error {
	return runRain8Command(n, false)
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
