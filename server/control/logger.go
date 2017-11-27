package control

import (
	"fmt"

	"github.com/golang/glog"
)

type LogVerbosity int

const (
	Error LogVerbosity = iota
	Info
	Debug
)

// Logger is a logger.
type Logger interface {
	// Debugf logs the message with DEBUG level of LogVerbosity.
	Debugf(s string, p ...interface{})
	// Infof logs the message with INFO level of LogVerbosity.
	Infof(s string, p ...interface{})
	// Errorf logs the message with ERROR level of LogVerbosity.
	Errorf(s string, p ...interface{})
}

// SystemLogger is a Logger that uses glog system log.
type SystemLogger struct {
	LogVerbosity LogVerbosity
}

// Debugf implements Logger#Debugf.
func (l *SystemLogger) Debugf(s string, p ...interface{}) {
	if l.LogVerbosity < Debug {
		return
	}
	glog.Infof("DEBUG: " + s, p...)
}

// Infof implements Logger#Infof.
func (*SystemLogger) Infof(s string, p ...interface{}) {
	glog.Infof("INFO: " + s, p...)
}

// Errorf mplements Logger#Errorf.
func (*SystemLogger) Errorf(s string, p ...interface{}) {
	glog.Errorf("ERROR: " + s, p...)
}

// ConsoleLogger is a Logger that uses the console.
type ConsoleLogger struct {
	LogVerbosity LogVerbosity
}

// Debugf implements Logger#Debugf.
func (l *ConsoleLogger) Debugf(s string, p ...interface{}) {
	if l.LogVerbosity < Debug {
		return
	}
	fmt.Printf("DEBUG: " + s+"\n", p...)
}

// Infof implements Logger#Infof.
func (*ConsoleLogger) Infof(s string, p ...interface{}) {
	fmt.Printf("INFO: " + s+"\n", p...)
}

// Errorf mplements Logger#Errorf.
func (*ConsoleLogger) Errorf(s string, p ...interface{}) {
	fmt.Printf("ERROR: " + s+"\n", p...)
}
