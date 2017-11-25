package main

import (
	"fmt"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
)

const (
	maxZoneNum = 8
	maxRunMins = 90
	
	wwwRoot = "I:/github/irctl/www"
)


func runzoneHandler(w http.ResponseWriter, r *http.Request) {
	numStr := r.FormValue("num")
	if numStr == "" {
		http.Error(w, "num parameter not specified", http.StatusBadRequest)
		return
	}
	minsStr := r.FormValue("mins")
	if minsStr == "" {
		http.Error(w, "mins parameter not specified", http.StatusBadRequest)
		return
	}

	num, err := strconv.ParseInt(numStr, 10, 32)
	if err != nil {
		http.Error(w, "num: " + err.Error(), http.StatusInternalServerError)
		return
	}
	if num < 0 || num > maxZoneNum {
		http.Error(w, fmt.Sprintf("num value %d out of range [0,%d]", num, maxZoneNum), http.StatusBadRequest)
		return
	}
	mins, err := strconv.ParseInt(minsStr, 10, 32)
	if err != nil {
		http.Error(w, "mins: " + err.Error(), http.StatusInternalServerError)
		return
	}
	if mins < 0 || mins > maxRunMins {
		http.Error(w, fmt.Sprintf("mins value %d out of range [0,%d]", num, maxRunMins), http.StatusBadRequest)
		return
	}
	err = runRain8Command(int(num), true)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	fmt.Fprintf(w, "<div>zone %d for %d mins: SUCCESS</div>", num, mins)
}

func main() {
	fs := http.FileServer(http.Dir(wwwRoot))

	http.Handle("/", fs)
	http.HandleFunc("/runzone", runzoneHandler)

	fmt.Println("Listening...")
	err := http.ListenAndServe(":8080", nil)
	fmt.Println(err)
}
