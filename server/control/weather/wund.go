package weather

import (
	"encoding/json"
	"fmt"

	log "github.com/golang/glog"
)

// WundergroundConditionsGetter is a ConditionsGetter for Wunderground.
type WundergroundConditionsGetter struct {
	apiKey  string
	urlBase string
}

// NewWundergroundConditionsGetter returns a ptr to an initialized
// WundergroundConditionsGetter.
func NewWundergroundConditionsGetter() *WundergroundConditionsGetter {
	// forecast
	//http://api.wunderground.com/api/4f746c425fb69966/geolookup/conditions/forecast/q/KSJC.json
	// yesterady
	//http://api.wunderground.com/api/4f746c425fb69966/geolookup/conditions/yesterday/q/KSJC.json
	apiKeyStr := `4f746c425fb69966`
	return &WundergroundConditionsGetter{
		apiKey:  apiKeyStr,
		urlBase: `http://api.wunderground.com/api/` + apiKeyStr + `/geolookup/conditions/`,
	}
}

// GetForecast implements ConditionsGetter#GetForecast.
func (w *WundergroundConditionsGetter) GetForecast(airportCode string) (icon string, tempF float64, precipIn float64, iconTom string, tempFTom float64, precipInTom float64, err error) {
	url := w.urlBase + "forecast/q/" + airportCode + ".json"
	log.Infof("GetForecast send request %s", url)
	resp, err := GetURL(url)
	if err != nil {
		return "", 0, 0, "", 0.0, 0.0, fmt.Errorf("GetForecast: %s", err)
	}
	ic, t, p, err := w.ParseForecast(resp, 0)
	if err != nil {
		return "", 0, 0, "", 0.0, 0.0, fmt.Errorf("GetForecast: %s", err)
	}
	ict, tt, pt, err2 := w.ParseForecast(resp, 1)
	return ic, t, p, ict, tt, pt, err2
}

// GetYesterday implements ConditionsGetter#GetYesterday.
func (w *WundergroundConditionsGetter) GetYesterday(airportCode string) (icon string, tempF float64, precipIn float64, err error) {
	url := w.urlBase + "yesterday/q/" + airportCode + ".json"
	log.Infof("GetYesterday send request %s", url)
	resp, err := GetURL(url)
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("GetYesterday: %s", err)
	}
	return w.ParseYesterday(resp)
}

// ParseForecast parses a forecast response from Wunderground.
// daysFromNow is how many days to look ahead (0 == today).
func (w *WundergroundConditionsGetter) ParseForecast(resp []byte, daysFromNow int) (icon string, tempF float64, precipIn float64, err error) {
	var jt map[string]interface{}
	if err := json.Unmarshal(resp, &jt); err != nil {
		return "", 0.0, 0.0, err
	}

	dstr := fmt.Sprint(daysFromNow)
	ici, err := GetPath(jt, "forecast/simpleforecast/forecastday/"+dstr+"/icon")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	ti, err := GetPath(jt, "forecast/simpleforecast/forecastday/"+dstr+"/high/fahrenheit")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	pi, err := GetPath(jt, "forecast/simpleforecast/forecastday/"+dstr+"/qpf_allday/in")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	icon = ici.(string)

	tempF, err = strIfToFloat32(ti)
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("tempF: %s", err)
	}

	if _, ok := pi.(float64); !ok {
		return "", 0.0, 0.0, fmt.Errorf("precipIn value has type %T, expect float64", pi)
	}
	precipIn = float64(pi.(float64))

	return
}

// ParseForecast parses a yesterday response from Wunderground.
func (w *WundergroundConditionsGetter) ParseYesterday(resp []byte) (icon string, tempF float64, precipIn float64, err error) {
	var jt map[string]interface{}
	if err := json.Unmarshal(resp, &jt); err != nil {
		return "", 0.0, 0.0, err
	}

	obsi, err := GetPath(jt, "history/observations")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}
	obs, ok := obsi.([]interface{})
	if !ok {
		return "", 0.0, 0.0, fmt.Errorf("bad observations array: \n%s\n", string(resp))
	}
	icon, err = w.getSummaryIcon(obs)
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	ti, err := GetPath(jt, "history/dailysummary/0/maxtempi")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	pi, err := GetPath(jt, "history/dailysummary/0/precipi")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	tempF, err = strIfToFloat32(ti)
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("tempF: %s", err)
	}

	precipIn, err = strIfToFloat32(pi)
	if err != nil {
		log.Errorf("precipIn has non-float value %s, returning 0.0", pi)
		return icon, tempF, 0.0, nil
	}

	return
}

// getSummaryIcon returns the most common icon in the set of observations arr.
// Each err member must map a map[string]interface{} with key "icon" present.
func (w *WundergroundConditionsGetter) getSummaryIcon(arr []interface{}) (string, error) {
	m := make(map[string]int)
	for _, oi := range arr {
		o := oi.(map[string]interface{})
		ici, err := GetPath(o, "icon")
		if err != nil {
			return "", fmt.Errorf("bad observation: \n%v\n", o)
		}
		m[ici.(string)] = m[ici.(string)] + 1
	}
	return stringMapMode(m), nil
}
