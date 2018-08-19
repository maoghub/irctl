package control

import (
	"fmt"
	"net/smtp"

	log "github.com/golang/glog"
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
}

// NewSMTPErrorReporter returns a ptr to an intialized SMTPErrorReporter.
func NewSMTPErrorReporter(sMTPServerAddr string, sMTPServerPort uint, senderAddr, recipientAddr, userName, password string) *SMTPErrorReporter {
	return &SMTPErrorReporter{
		sMTPServerAddr: sMTPServerAddr,
		sMTPServerPort: sMTPServerPort,
		senderAddr:     senderAddr,
		recipientAddr:  recipientAddr,
		userName:       userName,
		password:       password,
	}
}

// Report implements ErrorReporter#Report.
func (er *SMTPErrorReporter) Report(sendErr error) error {
	auth := smtp.PlainAuth("", er.userName, er.password, er.sMTPServerAddr)
	addrPort := er.sMTPServerAddr + ":" + fmt.Sprint(er.sMTPServerPort)

	log.Infof("Sending to %s at %s:\n%s", er.recipientAddr, addrPort, sendErr)

	if err := smtp.SendMail(addrPort, auth, er.senderAddr, []string{er.recipientAddr}, []byte(sendErr.Error())); err != nil {
		log.Errorf("%s", err)
	}

	return sendErr
}

// LogErrorReporter is an error reporter than logs to file.
type LogErrorReporter struct {
}

// NewLogErrorReporter returns a ptr to a LogErrorReporter.
func NewLogErrorReporter() (*LogErrorReporter, error) {
	return &LogErrorReporter{}, nil
}

// Report implements ErrorReporter#Report.
func (er *LogErrorReporter) Report(sendErr error) error {
	log.Error(sendErr)
	return sendErr
}
