package weather

import (
	"io/ioutil"
	"path/filepath"
	"testing"
)

const (
	testRoot = "testdata"
	accuweatherSubdir = "accuweather"
)

func TestAccuWeatherParseForecast(t *testing.T) {
	j, err := ioutil.ReadFile(filepath.Join(testRoot, accuweatherSubdir, "forecast.json"))
	if err != nil {
		t.Fatalf("ioutil.ReadFile: could not open file: %v", err)
	}

	wcg := &AccuWeatherConditionsGetter{}
	icon, tF, pIn, err := wcg.ParseForecast(j, 0)
	if err != nil {
		t.Errorf("ParseForecast: %v", err)
	}

	if icon != "mostlysunny" || tF != 74.0 || pIn != 0.0 {
		t.Errorf("ParseForecast: got %s / %3.2f / %3.2f, want mostlysunny / 74.0 / 0.0", icon, tF, pIn)
	}
}

func TestAccuWeatherParseYesterday(t *testing.T) {
	j, err := ioutil.ReadFile(filepath.Join(testRoot, accuweatherSubdir, "yesterday.json"))
	if err != nil {
		t.Fatalf("ioutil.ReadFile: could not open file: %v", err)
	}

	wcg := &AccuWeatherConditionsGetter{}
	icon, tF, pIn, err := wcg.ParseYesterday(j)
	if err != nil {
		t.Errorf("ParseYesterday: %v", err)
	}

	if icon != "unknown" || tF != 71.0 || pIn != 0.0 {
		t.Errorf("ParseYesterday: got %s / %3.2f / %3.2f, want unknown / 71.0 / 0.0", icon, tF, pIn)
	}
}
