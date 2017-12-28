package control

import (
	"fmt"
	"net/smtp"
	"os"
)

// ErrorReporter is used to report an error.
type ErrorReporter interface {
	// Report reports the error err and also returns it unmodified.
	Report(err error) error
}

// SMTPErrorReporter is an ErrorReporter that uses SMTP.
type SMTPErrorReporter struct {
	sMTPServerAddr string
	sMTPServerPort uint
	senderAddr     string
	recipientAddr  string
	userName       string
	password       string
	log            Logger
}

// NewSMTPErrorReporter returns a ptr to an intialized SMTPErrorReporter.
func NewSMTPErrorReporter(sMTPServerAddr string, sMTPServerPort uint, senderAddr, recipientAddr, userName, password string, log Logger) *SMTPErrorReporter {
	return &SMTPErrorReporter{
		sMTPServerAddr: sMTPServerAddr,
		sMTPServerPort: sMTPServerPort,
		senderAddr:     senderAddr,
		recipientAddr:  recipientAddr,
		userName:       userName,
		password:       password,
		log:            log,
	}
}

// Report implements ErrorReporter#Report.
func (er *SMTPErrorReporter) Report(sendErr error) error {
	auth := smtp.PlainAuth("", er.userName, er.password, er.sMTPServerAddr)
	addrPort := er.sMTPServerAddr + ":" + fmt.Sprint(er.sMTPServerPort)

	er.log.Infof("Sending to %s at %s:\n%s", er.recipientAddr, addrPort, sendErr)

	if err := smtp.SendMail(addrPort, auth, er.senderAddr, []string{er.recipientAddr}, []byte(sendErr.Error())); err != nil {
		er.log.Errorf("%s", err)
	}

	return sendErr
}

// LogErrorReporter is an error reporter than logs to file.
type LogErrorReporter struct {
	logPath string
}

// NewLogErrorReporter returns a ptr to a LogErrorReporter.
func NewLogErrorReporter(logPath string) (*LogErrorReporter, error) {
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE, 0666)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return &LogErrorReporter{
		logPath: logPath,
	}, nil
}

// Report implements ErrorReporter#Report.
func (er *LogErrorReporter) Report(sendErr error) error {
	f, err := os.OpenFile(er.logPath, os.O_APPEND, 0666)
	if err != nil {
		return err
	}

	defer f.Close()

	if _, err = f.WriteString(sendErr.Error() + "\n"); err != nil {
		return err
	}
	
	return nil
}

// LoggerErrorReporter is an error reporter than logs to the supplied Logger.
type LoggerErrorReporter struct {
	log Logger
}

// NewLoggerErrorReporter returns a ptr to a LoggerErrorReporter.
func NewLoggerErrorReporter(log Logger) (*LoggerErrorReporter, error) {
	return &LoggerErrorReporter{
		log: log,
	}, nil	
}

// Report implements ErrorReporter#Report.
func (er *LoggerErrorReporter) Report(err error) error {
	er.log.Errorf("ERROR_LOGGER: " + err.Error())
	return nil
}
