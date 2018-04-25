package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strconv"
	"time"

	"irctl/server/control"
)

const (
	// maxRunMins is the longest legal manual runtime.
	maxRunMins = 90

	// wwwRoot is the root dir for the web server content.
	wwwRoot = "../www"
	// dataLogPath is the root dir for where conditions and runtimes are logged.
	dataLogPath = "../data"
	// confFilePath is the path to the config file.
	confFilePath = "../www/conf/irctl_conf.json"
	// kVStorePath is the path for the KV store.
	kVStorePath = "../../kvstore"
	// errLogPath is the path for error log file, which can be checked by HTTP
	// clients.
	errLogPath = "../../errlog"
)

var (
	// Instance variables to share with HTTP handlers.
	valveController control.ValveController
	log             control.Logger
	dataLogger      *control.DataLogger
)

func main() {
	log = &control.ConsoleLogger{LogVerbosity: control.Debug}
	dataLogger = control.NewDataLogger(log, dataLogPath)

	var valveControllerStr string
	var runControlLoop, init bool
	acn := fmt.Sprint(control.AvailableControllerNames())
	flag.StringVar(&valveControllerStr, "controller", "console", "Valve controller to use (default console). Choose from "+acn)
	flag.BoolVar(&runControlLoop, "runloop", false, "Run the control loop (false runs server only).")
	flag.BoolVar(&init, "init", false, "Erase the keystore state (reset) and assume that all zones are fully watered.")
	flag.Parse()

	if init {
		log.Infof("Removing keystore...: %s", os.RemoveAll(kVStorePath))
	}

	var err error
	valveController, err = control.NewValveController(valveControllerStr, log)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Printf("Using controller %s.\n", valveControllerStr)

	kv, err := control.NewBadgerKVStore(kVStorePath, log)
	if err != nil {
		fmt.Println(err)
		return
	}

	rparam := control.RunParams{
		ConfigPath:  confFilePath,
		DataLogPath: dataLogPath,
		LogLevel:    control.Debug,
	}

	zc := *control.NewZoneController(valveController, kv, log)
	cg := control.NewWundergroundConditionsGetter(log)
	er, err := control.NewLoggerErrorReporter(log)
	if err != nil {
		fmt.Println(err)
		return
	}

	if runControlLoop {
		go control.Run(&rparam, kv, cg, zc, er, log, init)
	} else {
		fmt.Println("Not running control loop, HTTP server only.")
	}

	http.Handle("/", loggingHandler(http.FileServer(http.Dir(wwwRoot))))
	http.HandleFunc("/runzone", runzoneHandler)
	http.HandleFunc("/runzonestop", runzoneStopHandler)
	http.HandleFunc("/conditions", conditionsHandler)
	http.HandleFunc("/runtimes", runtimesHandler)
	http.HandleFunc("/setconfig", setConfigHandler)

	fmt.Println("Listening...")
	err = http.ListenAndServe(":8080", nil)
	fmt.Println(err)
}

// conditionsHandler returns the conditions for the specified "from" to "to" URL
// param range as a serialized struct of []*control.ConditionsEntry and
// errors as []string.
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
		Errors     []string
	}{
		Conditions: conditions,
		Errors:     control.ToStringSlice(errs),
	}

	j, err := json.Marshal(resp)
	if err != nil {
		httpError(w, r, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Debugf("return value: %s", string(j))
	fmt.Fprintf(w, "%s", string(j))
}

// runtimesHandler returns the run times for the specified "from" to "to" URL
// param range as a serialized struct of []*control.ConditionsEntry and
// errors as []string.
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
		Errors   []string
	}{
		Runtimes: runtimes,
		Errors:   control.ToStringSlice(errs),
	}

	j, err := json.Marshal(resp)
	if err != nil {
		httpError(w, r, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Debugf("return value: %s", string(j))
	fmt.Fprintf(w, "%s", string(j))
}

// setConfigHandler updates the config with the given JSON POST body string.
func setConfigHandler(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusInternalServerError)
		return
	}

	j := make(map[string]interface{})
	if err := json.Unmarshal(body, &j); err != nil {
		http.Error(w, "Error unmarshaling body: "+err.Error(), http.StatusInternalServerError)
		return
	}
	var sc control.SystemConfig
	if err := sc.Parse(string(body)); err != nil {
		http.Error(w, "Error in config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	js, err := json.MarshalIndent(j, "", "  ")
	if err := ioutil.WriteFile(confFilePath, js, 0644); err != nil {
		http.Error(w, "Error writing file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	log.Infof("setConfHandler succeeded with \n%s\n", js)
	fmt.Fprintf(w, "OK")
}

// runzoneHandler runs a zone for a number of minutes.
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
	if num < 0 || int(num) >= valveController.NumValves() {
		httpError(w, r, fmt.Sprintf("num value %d out of range [0,%d]", num, valveController.NumValves()), http.StatusBadRequest)
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

	// Only one manual command may run. Manual commands may not run during auto
	// run.
	if control.CommandRunning {
		// There's an unavoidable race here, but worst that can happen is
		// command from UI will time out. We just want to avoid that happening
		// most of the time if it's due to something already running.
		httpError(w, r, "Another manual or auto run is currently in progress.", http.StatusInternalServerError)
		return
	}
	control.CommandRunningMu.Lock()
	control.CommandRunning = true

	err = valveController.OpenValve(int(num))
	if err != nil {
		httpError(w, r, err.Error(), http.StatusInternalServerError)
		return
	}

	go func() {
		time.Sleep(time.Duration(mins) * time.Minute)
		control.CommandRunningMu.Unlock()
		control.CommandRunning = false

		err = valveController.CloseValve(int(num))
		if err != nil {
			// This is a tricky situation. We don't want to keep Running set to
			// true since this will block everything. Rather, rely on
			// periodic closer to take care of this eventually.
			log.Errorf("CloseValve %d failed: %s", num, err)
			return
		}
	}()

	fmt.Fprintf(w, "OK - running zone %d for %d mins.", num, mins)
}

// runzoneStopHandler runs a zone for a number of minutes.
func runzoneStopHandler(w http.ResponseWriter, r *http.Request) {
	numStr := r.FormValue("num")
	if numStr == "" {
		httpError(w, r, "num parameter not specified", http.StatusBadRequest)
		return
	}

	num, err := strconv.ParseInt(numStr, 10, 32)
	if err != nil {
		httpError(w, r, "num: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if num < 0 || int(num) >= valveController.NumValves() {
		httpError(w, r, fmt.Sprintf("num value %d out of range [0,%d]", num, valveController.NumValves()), http.StatusBadRequest)
		return
	}
	err = valveController.CloseValve(int(num))
	if err != nil {
		log.Errorf("CloseValve %d failed: %s", num, err)
		return
	}
	control.CommandRunningMu.Unlock()
	control.CommandRunning = false

	fmt.Fprintf(w, "OK")
}

// loggingHandler adds a layer of logging to the regual HTTP handler.
func loggingHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Infof("%s:%s", r.Method, r.URL.Path)
		h.ServeHTTP(w, r)
	})
}

// getToFromRange extracts "to" and "from" URL params from the supplied request
// and returns them as Time structs.
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

// strToDate creates a time object from a date string, which has only the date
// fields set to the supplied values and other fields as default.
func strToDate(s string) (time.Time, error) {
	return time.Parse("2006-01-02", s)
}

// httpError logs the given error and status and adds it to the response writer,
// which will display the error back to the HTTP client. It also returns msg as
// an error.
func httpError(w http.ResponseWriter, r *http.Request, msg string, status int) error {
	e := fmt.Sprintf("%s: %s", r.URL.String(), msg)
	log.Errorf(e)
	http.Error(w, msg, status)
	return fmt.Errorf(e)
}
