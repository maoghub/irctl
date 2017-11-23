package control

import (
	"io/ioutil"
	"path/filepath"
	"testing"
)

const (
	testRoot = "."
)

func TestWundergroundParseForecast(t *testing.T) {
	j, err := ioutil.ReadFile(filepath.Join(testRoot, "testdata", "forecast.json"))
	if err != nil {
		t.Fatalf("ioutil.ReadFile: could not open file: %v", err)
	}

	wcg := &WundergroundConditionsGetter{}
	icon, tF, pIn, err := wcg.ParseForecast(j)
	if err != nil {
		t.Errorf("ParseForecast: %v", err)
	}

	if icon != "clear" || tF != 91 || pIn != 0.0 {
		t.Errorf("ParseForecast: got %3.2f / %3.2f, want 60 / 0.0", tF, pIn)
	}
}

func TestWundergroundParseYesterday(t *testing.T) {
	j, err := ioutil.ReadFile(filepath.Join(testRoot, "testdata", "yesterday.json"))
	if err != nil {
		t.Fatalf("ioutil.ReadFile: could not open file: %v", err)
	}

	wcg := &WundergroundConditionsGetter{}
	icon, tF, pIn, err := wcg.ParseYesterday(j)
	if err != nil {
		t.Errorf("ParseYesterday: %v", err)
	}

	if icon != "partlycloudy" || tF != 89 || pIn != 0.0 {
		t.Errorf("ParseYesterday: got %s / %3.2f / %3.2f, want clear / 89 / 0.0", icon, tF, pIn)
	}
}
