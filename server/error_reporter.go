package control

import (
	"fmt"
	"net/smtp"
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
