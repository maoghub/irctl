package control

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"
)

// ConditionsGetter reports conditions used in ET calculations.
type ConditionsGetter interface {
	// GetForecast reports the forecast for the coming day for the given
	// airportCode.
	GetForecast(airportCode string) (icon string, tempF float64, precipIn float64, err error)
	// GetForecast reports the conditions for the previous day for the given
	// airportCode.
	GetYesterday(airportCode string) (icon string, tempF float64, precipIn float64, err error)
}

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
func (w *WundergroundConditionsGetter) GetForecast(airportCode string) (icon string, tempF float64, precipIn float64, err error) {
	resp, err := w.getURL(w.urlBase + "forecast/q/" + airportCode + ".json")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("GetForecast: %s", err)
	}
	return w.ParseForecast(resp)
}

// GetYesterday implements ConditionsGetter#GetYesterday.
func (w *WundergroundConditionsGetter) GetYesterday(airportCode string) (icon string, tempF float64, precipIn float64, err error) {
	resp, err := w.getURL(w.urlBase + "yesterday/q/" + airportCode + ".json")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("GetYesterday: %s", err)
	}
	return w.ParseYesterday(resp)
}

// ParseForecast parses a forecast response from Wunderground.
func (w *WundergroundConditionsGetter) ParseForecast(resp []byte) (icon string, tempF float64, precipIn float64, err error) {
	var jt map[string]interface{}
	if err := json.Unmarshal(resp, &jt); err != nil {
		return "", 0.0, 0.0, err
	}

	ici, err := w.getPath(jt, "forecast/simpleforecast/forecastday/0/icon")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	ti, err := w.getPath(jt, "forecast/simpleforecast/forecastday/0/high/fahrenheit")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	pi, err := w.getPath(jt, "forecast/simpleforecast/forecastday/0/qpf_allday/in")
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

	obsi, err := w.getPath(jt, "history/observations")
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


	ti, err := w.getPath(jt, "history/dailysummary/0/maxtempi")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	pi, err := w.getPath(jt, "history/dailysummary/0/precipi")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	tempF, err = strIfToFloat32(ti)
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("tempF: %s", err)
	}

	precipIn, err = strIfToFloat32(pi)
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("precipIn: %s", err)
	}

	return
}

// getPath returns the value at the given path in the JSON tree jt.
func (w *WundergroundConditionsGetter) getPath(jt map[string]interface{}, pathStr string) (interface{}, error) {
	path := strings.Split(pathStr, "/")
	var vi interface{} = jt
	for i, p := range path {
		if vi == nil {
			return nil, fmt.Errorf("tree is nil at path %v (%v)", path[0:i+1], path)
		}

		if _, ok := vi.([]interface{}); ok {
			idx, err := strconv.ParseUint(p, 10, 32)
			if err != nil {
				return nil, fmt.Errorf("path %v index element %s has bad int value: %v", path, p, err)
			}
			v := vi.([]interface{})
			if idx >= uint64(len(v)) {
				return nil, fmt.Errorf("index %d >= len %d at path %v (%v)", idx, len(v), path[0:i+1], path)
			}
			vi = v[idx]
			continue
		}

		v, ok := vi.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("got type %T at path %v (%v), expect map[string]interface{}", vi, path[0:i+1], path)
		}
		vi, ok = v[p]
		if !ok {
			return nil, fmt.Errorf("next element %s not found at path %v (%v)", p, path[0:i], path)
		}
	}

	return vi, nil
}

// getURL returns the response for a GET to url.
func (w *WundergroundConditionsGetter) getURL(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return ioutil.ReadAll(resp.Body)
}

// strIfToFloat32 returns the float64 value of an interface{} with dynamic type
// string, if a conversion to float is possible, or an error otherwise.
func strIfToFloat32(si interface{}) (float64, error) {
	s, ok := si.(string)
	if !ok {
		return 0.0, fmt.Errorf("value has type %T, expect string", si)
	}
	f64, err := strconv.ParseFloat(s, 32)
	if err != nil {
		return 0.0, fmt.Errorf("bad float value %s", s)
	}

	return float64(f64), nil
}

// getSummaryIcon returns the most common icon in the set of observations arr.
// Each err member must map a map[string]interface{} with key "icon" present.
func (w *WundergroundConditionsGetter) getSummaryIcon(arr []interface{}) (string, error) {
	m := make(map[string]int)
	for _, oi := range arr {
		o := oi.(map[string]interface{})
		ici, err := w.getPath(o, "icon")
		if err != nil {
			return "", fmt.Errorf("bad observation: \n%v\n", o)
		}
		m[ici.(string)] = m[ici.(string)] + 1
	}
	return stringMapMode(m), nil	
}

// stringMapMode returns the most often occurring key in m, where the map value
// is the number of occurrences of the key.
func stringMapMode(m map[string]int) string {
	maxK := ""
	maxCnt := -1
	
	for k, cnt := range m {
		if cnt > maxCnt {
			maxK = k
			maxCnt = cnt
		}
	}
	
	return maxK
}

