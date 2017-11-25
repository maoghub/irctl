package control

import (
	"fmt"
	"time"
)

// ValveController is a valve controller.
type ValveController interface {
	// OpenValve opens valve number n.
	OpenValve(n int) error
	// CloseValve closes valve number n.
	CloseValve(n int) error
}

type Rain8ValveController struct {
	
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
