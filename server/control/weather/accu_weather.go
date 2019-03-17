package weather

import (
	"encoding/json"
	"fmt"

	log "github.com/golang/glog"
)

var (
	accuweatherIconMap = map[int]string{
		1:  "sunny",
		2:  "mostlysunny",
		3:  "partlysunny",
		4:  "partlysunny",
		5:  "hazy",
		6:  "mostlycloudy",
		7:  "cloudy",
		8:  "cloudy",
		11: "fog",
		12: "rain",
		13: "rain",
		14: "rain",
		15: "tstorms",
		16: "rain",
		17: "rain",
		18: "rain",
		19: "flurries",
		20: "mostlycloudy",
		21: "partlysunny",
		22: "snow",
		23: "mostlycloudy",
		24: "snow",
		25: "sleet",
		26: "rain",
		29: "snow",
	}
)

// AccuWeatherConditionsGetter is a ConditionsGetter for Wunderground.
type AccuWeatherConditionsGetter struct {
	apiKey         string
	locationKeyStr string
	urlBase        string
}

// NewAccuWeatherConditionsGetter returns a ptr to an initialized
// AccuWeatherConditionsGetter.
func NewAccuWeatherConditionsGetter() *AccuWeatherConditionsGetter {
	// forecast
	// http://dataservice.accuweather.com/forecasts/v1/daily/5day/331979?apikey=ERwBwIsOlAoQ7qIwxpdgBJpBQxXd6ARX
	// yesterday
	// http://dataservice.accuweather.com/currentconditions/v1/331979/historical/24?apikey=ERwBwIsOlAoQ7qIwxpdgBJpBQxXd6ARX&details=true
	apiKeyStr := `ERwBwIsOlAoQ7qIwxpdgBJpBQxXd6ARX`
	locationKeyStr := `331979`
	return &AccuWeatherConditionsGetter{
		apiKey:  apiKeyStr,
		locationKeyStr: locationKeyStr,
		urlBase: `http://dataservice.accuweather.com/`,
	}
}

// GetForecast implements ConditionsGetter#GetForecast.
func (w *AccuWeatherConditionsGetter) GetForecast(airportCode string) (icon string, tempF float64, precipIn float64, iconTom string, tempFTom float64, precipInTom float64, err error) {
	// http://dataservice.accuweather.com/forecasts/v1/daily/5day/331979?apikey=ERwBwIsOlAoQ7qIwxpdgBJpBQxXd6ARX&details=true
	url := w.urlBase + "forecasts/v1/daily/5day/" + w.locationKeyStr + "?details=true&apikey=" + w.apiKey
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
func (w *AccuWeatherConditionsGetter) GetYesterday(airportCode string) (icon string, tempF float64, precipIn float64, err error) {
	// http://dataservice.accuweather.com/currentconditions/v1/331979/historical/24?apikey=ERwBwIsOlAoQ7qIwxpdgBJpBQxXd6ARX&details=true
	url := w.urlBase + "currentconditions/v1/" + w.locationKeyStr + "/historical/24?details=true&apikey=" + w.apiKey
	log.Infof("GetYesterday send request %s", url)
	resp, err := GetURL(url)
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("GetYesterday: %s", err)
	}
	return w.ParseYesterday(resp)
}

func (w *AccuWeatherConditionsGetter) normalizeIcon(iconNum int) string {
	ret, ok := accuweatherIconMap[iconNum]
	if !ok {
		return "unknown"
	}
	return ret
}

func getFloat(i interface{}) float64 {
	if v, ok := i.(float64); ok {
		return v
	}
	if v, ok := i.(int); ok {
		return float64(v)
	}
	log.Errorf("getFloat called with type %T, value %v", i, i)
	return 0.0
}

func getInt(i interface{}) int {
	if v, ok := i.(float64); ok {
		return int(v)
	}
	if v, ok := i.(int); ok {
		return v
	}
	log.Errorf("getInt called with type %T, value %v", i, i)
	return 0.0
}

// ParseForecast parses a forecast response from Wunderground.
// daysFromNow is how many days to look ahead (0 == today).
func (w *AccuWeatherConditionsGetter) ParseForecast(resp []byte, daysFromNow int) (icon string, tempF float64, precipIn float64, err error) {
	var jt map[string]interface{}
	if err := json.Unmarshal(resp, &jt); err != nil {
		return "", 0.0, 0.0, err
	}
	// DailyForecasts[0] / Temperature / Maximum / Value
	days, ok := jt["DailyForecasts"]
	if !ok {
		return "", 0.0, 0.0, fmt.Errorf("could not find DailyForecasts in response:\n%s", string(resp))
	}
	ds, ok := days.([]interface{})
	if !ok {
		return "", 0.0, 0.0, fmt.Errorf("DailyForecasts not a slice in response:\n%s", string(resp))
	}
	if len(ds) < 1 {
		return "", 0.0, 0.0, fmt.Errorf("DailyForecasts too short response:\n%s", string(resp))
	}

	dt, ok := ds[daysFromNow].(map[string]interface{})
	if !ok {
		return "", 0.0, 0.0, fmt.Errorf("not a slice of maps in response:\n%s", string(resp))
	}

	iciN, err := GetPath(dt, "Day/Icon")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	ti, err := GetPath(dt, "Temperature/Maximum/Value")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	pi, err := GetPath(dt, "Day/Rain/Value")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	icon = w.normalizeIcon(getInt(iciN))

	return icon, getFloat(ti), getFloat(pi), nil
}

// ParseYesterday parses a yesterday response from Wunderground.
func (w *AccuWeatherConditionsGetter) ParseYesterday(resp []byte) (icon string, tempF float64, precipIn float64, err error) {
	// [0]/PrecipitationSummary/Past24Hours/Imperial/Value
	// [0]/TemperatureSummary/Past24HourRange/Maximum/Imperial/Value
	var js []interface{}
	if err := json.Unmarshal(resp, &js); err != nil {
		return "", 0.0, 0.0, err
	}
	if len(js) < 1 {
		return "", 0.0, 0.0, fmt.Errorf("yesterday too short response:\n%s", string(resp))
	}
	jt, ok := js[0].(map[string]interface{})
	if !ok {
		return "", 0.0, 0.0, fmt.Errorf("not a slice of maps in response:\n%s", string(resp))
	}

	ti, err := GetPath(jt, "TemperatureSummary/Past24HourRange/Maximum/Imperial/Value")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	pi, err := GetPath(jt, "PrecipitationSummary/Past24Hours/Imperial/Value")
	if err != nil {
		return "", 0.0, 0.0, fmt.Errorf("%v: \n\n%s", err, string(resp))
	}

	return "unknown", getFloat(ti), getFloat(pi), nil
}
