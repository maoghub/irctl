package weather

import (
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
	GetForecast(airportCode string) (icon string, tempF float64, precipIn float64,
		iconTom string, tempFTom float64, precipInTom float64, err error)
	// GetForecast reports the conditions for the previous day for the given
	// airportCode.
	GetYesterday(airportCode string) (icon string, tempF float64, precipIn float64, err error)
}

// GetPath returns the value at the given path in the JSON tree jt.
func GetPath(jt map[string]interface{}, pathStr string) (interface{}, error) {
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

// GetURL returns the response for a GET to url.
func GetURL(url string) ([]byte, error) {
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
