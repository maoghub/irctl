package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"irctl/server/control"
)

const (
	maxZoneNum = 8
	maxRunMins = 90

	//	wwwRoot = "/Users/sarahkim/Documents/code/go/src/irctl/www"
	wwwRoot     = "../www"
	dataLogPath = "../data"
)

var (
	valveController control.ValveController
	log             control.Logger
	dataLogger      *control.DataLogger
)

func main() {
	log = &control.ConsoleLogger{LogVerbosity: control.Debug}
	valveController = control.NewConsoleValveController(log)
	dataLogger = control.NewDataLogger(log, dataLogPath, maxZoneNum)

	http.Handle("/", loggingHandler(http.FileServer(http.Dir(wwwRoot))))
	http.HandleFunc("/runzone", runzoneHandler)
	http.HandleFunc("/conditions", conditionsHandler)
	http.HandleFunc("/runtimes", runtimesHandler)

	fmt.Println("Listening...")
	err := http.ListenAndServe(":8080", nil)
	fmt.Println(err)
}

func loggingHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Infof("%s:%s", r.Method, r.URL.Path)
		h.ServeHTTP(w, r)
	})
}

func strToDate(s string) (time.Time, error) {
	return time.Parse("2006-01-02", s)
}

func getToFromRange(w http.ResponseWriter, r *http.Request) (from, to time.Time, err error) {
	fromStr := r.FormValue("from")
	if fromStr == "" {
		err = httpError(w, r, "from parameter not specified", http.StatusBadRequest)
		return
	}
	toStr := r.FormValue("to")
	if toStr == "" {
		err = httpError(w, r, "to parameter not specified", http.StatusBadRequest)
		return
	}

	from, err = strToDate(fromStr)
	if err != nil {
		err = httpError(w, r, "from: "+err.Error(), http.StatusInternalServerError)
		return
	}

	to, err = strToDate(toStr)
	if err != nil {
		err = httpError(w, r, "to: "+err.Error(), http.StatusInternalServerError)
		return
	}

	return
}

func conditionsHandler(w http.ResponseWriter, r *http.Request) {
	log.Infof("conditionsHandler: %s", r.URL.String())
	from, to, err := getToFromRange(w, r)
	if err != nil {
		return
	}

	conditions, errs := dataLogger.ReadConditions(from, to)
	if errs != nil {
		log.Errorf(errs.Error())
	}
	
	resp := struct {
		Conditions []*control.ConditionsEntry
		Errors []string
	} {
		Conditions: conditions,
		Errors:  control.ToStringSlice(errs), 
	}

	j, err := json.Marshal(resp)
	if err != nil {
		httpError(w, r, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Debugf("return value: %s", string(j))
	fmt.Fprintf(w, "%s", string(j))
}

func runtimesHandler(w http.ResponseWriter, r *http.Request) {
	log.Infof("runtimesHandler: %s", r.URL.String())
	from, to, err := getToFromRange(w, r)
	if err != nil {
		return
	}

	runtimes, errs := dataLogger.ReadRuntimes(from, to)
	if errs != nil {
		log.Errorf(errs.Error())
	}
	
	resp := struct {
		Runtimes []*control.RuntimesEntry
		Errors []string
	} {
		Runtimes: runtimes,
		Errors:  control.ToStringSlice(errs), 
	}

	j, err := json.Marshal(resp)
	if err != nil {
		httpError(w, r, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Debugf("return value: %s", string(j))
	fmt.Fprintf(w, "%s", string(j))
}

func runzoneHandler(w http.ResponseWriter, r *http.Request) {
	numStr := r.FormValue("num")
	if numStr == "" {
		httpError(w, r, "num parameter not specified", http.StatusBadRequest)
		return
	}
	minsStr := r.FormValue("mins")
	if minsStr == "" {
		httpError(w, r, "mins parameter not specified", http.StatusBadRequest)
		return
	}

	num, err := strconv.ParseInt(numStr, 10, 32)
	if err != nil {
		httpError(w, r, "num: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if num < 0 || num > maxZoneNum {
		httpError(w, r, fmt.Sprintf("num value %d out of range [0,%d]", num, maxZoneNum), http.StatusBadRequest)
		return
	}
	mins, err := strconv.ParseInt(minsStr, 10, 32)
	if err != nil {
		httpError(w, r, "mins: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if mins < 0 || mins > maxRunMins {
		httpError(w, r, fmt.Sprintf("mins value %d out of range [0,%d]", num, maxRunMins), http.StatusBadRequest)
		return
	}

	err = valveController.OpenValve(int(num))
	if err != nil {
		httpError(w, r, err.Error(), http.StatusInternalServerError)
		return
	}

	time.Sleep(time.Duration(mins) * time.Minute)

	err = valveController.CloseValve(int(num))
	if err != nil {
		httpError(w, r, err.Error(), http.StatusInternalServerError)
		return
	}

	fmt.Fprintf(w, "<div>Successfully ran zone %d for %d mins.</div>", num, mins)
}

func httpError(w http.ResponseWriter, r *http.Request, msg string, status int) error {
	e := fmt.Sprintf("%s: %s", r.URL.String(), msg)
	log.Errorf(e)
	http.Error(w, msg, status)
	return fmt.Errorf(e)
}
