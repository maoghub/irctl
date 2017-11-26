package main

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"irctl/server/control"
)

const (
	maxZoneNum = 8
	maxRunMins = 90

	wwwRoot = "I:/github/irctl/www"
)

var (
	valveController control.ValveController
	log      control.Logger
)

func httpError(w http.ResponseWriter, r *http.Request, msg string, status int) {
	log.Errorf("%s: %s", r.URL.String(), msg)
	http.Error(w, msg, http.StatusBadRequest)
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

func main() {
	log = &control.ConsoleLogger{}
	valveController = control.NewConsoleValveController(log)

	fs := http.FileServer(http.Dir(wwwRoot))

	http.Handle("/", fs)
	http.HandleFunc("/runzone", runzoneHandler)

	fmt.Println("Listening...")
	err := http.ListenAndServe(":8080", nil)
	fmt.Println(err)
}
