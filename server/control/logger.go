package control

import (
	"fmt"

	"github.com/golang/glog"
)

// Logger is a logger.
type Logger interface {
	// Debugf logs the message with DEBUG level of severity if doLog is set to
	// to true, or logs nothing otherwise.
	Debugf(doLog bool, s string, p ...interface{})
	// Infof logs the message with INFO level of severity.
	Infof(s string, p ...interface{})
	// Errorf logs the message with ERROR level of severity.
	Errorf(s string, p ...interface{})
}

// SystemLogger is a Logger that uses glog system log.
type SystemLogger struct{}

// Debugf implements Logger#Debugf.
func (*SystemLogger) Debugf(doLog bool, s string, p ...interface{}) {
	if !doLog {
		return
	}
	glog.Infof(s, p...)
}

// Infof implements Logger#Infof.
func (*SystemLogger) Infof(s string, p ...interface{}) {
	glog.Infof(s, p...)
}

// Errorf mplements Logger#Errorf.
func (*SystemLogger) Errorf(s string, p ...interface{}) {
	glog.Errorf(s, p...)
}

// ConsoleLogger is a Logger that uses the console.
type ConsoleLogger struct{}

// Debugf implements Logger#Debugf.
func (*ConsoleLogger) Debugf(doLog bool, s string, p ...interface{}) {
	if !doLog {
		return
	}
	fmt.Printf(s + "\n", p...)
}

// Infof implements Logger#Infof.
func (*ConsoleLogger) Infof(s string, p ...interface{}) {
	fmt.Printf(s + "\n", p...)
}

// Errorf mplements Logger#Errorf.
func (*ConsoleLogger) Errorf(s string, p ...interface{}) {
	fmt.Printf(s + "\n", p...)
}
