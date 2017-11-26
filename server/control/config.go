package control

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/golang/glog"
	"github.com/kylelemons/godebug/pretty"
)

const (
	PosInf float64 = 1e99
	NegInf float64 = -1e99
)

// SystemConfig is a complete configuration.
type SystemConfig struct {
	GlobalConfig            *GlobalConfig
	ZoneConfigs             map[int]*ZoneConfig
	ETAlgorithmSimpleConfig *ETAlgorithmSimple
	SoilConfigMap           map[string]*SoilConfig
}

func (sc *SystemConfig) NumZones() int {
	if len(sc.ZoneConfigs) == 0 {
		return 0
	}
	max := 0
	for _, v := range sc.ZoneConfigs {
		if v.Number > max {
			max = v.Number
		}
	}
	return max + 1
}

// GlobalConfig is the config component independent of zone.
type GlobalConfig struct {
	RunTimeAM   time.Time
	RunTimePM   time.Time
	AirportCode string
}

// ZoneConfig is the config for each zone.
type ZoneConfig struct {
	Name              string
	Number            int
	Enabled           bool
	GetsRain          bool
	SoilConfig        *SoilConfig
	MaxVWC            Pct
	MinVWC            Pct
	RunTimeMultiplier float64
	ZoneETRate        Pct
	DepthIn           float64
}

// SoilConfig is the config for soils.
type SoilConfig struct {
	Name   string
	MaxVWC Pct
}

var trimS = strings.TrimSpace

// Parse parses a configuration text block and populates sc with the parsed
// values.
/*
Example config:

#GLOBAL_CONFIG,airport_code,metric_units,morning_run_time,afternoon_run_time,startup_show
GLOBAL_CONFIG,KSJC,0,9:00,16:00,0

#ZONE,number,name,run,rain,soil_name,min_moist_pct,max_moist_pct,run_time_mult,root_depth,et_rate
ZONE,0,zone 0,1,1,Loam,10,20,1.0,8.0,1.0
ZONE,1,zone 1,1,0,Clay,11,21,2.0,9.0,2.0
ZONE,2,zone 2,0,1,Sandy Loam,12,22,3.0,11.0,3.0

#SOIL,name,max_moist_pct
SOIL,Loam,40.0
SOIL,Clay,50.0
SOIL,Sandy Loam,30.0

#ALGORITHM, {LOW-HIGH, PERCENT_ET}+
ALGORITHM,-50,25,50-65,50,65-75,75,75-,100
*/
func (sc *SystemConfig) Parse(conf string) error {
	var err error
	sc.SoilConfigMap = make(map[string]*SoilConfig)
	sc.ZoneConfigs = make(map[int]*ZoneConfig)

	// init the SoilTypeMap first, since ZoneConfig depends on it.
	lines := strings.Split(conf, "\n")
	sc.SoilConfigMap = make(map[string]*SoilConfig)

	for _, line := range lines {
		if skipLine(line) {
			continue
		}
		l := strings.Split(line, ",")
		if strings.HasPrefix(l[0], "SOIL") {
			soil, err := ParseSoilConfig(l[1:])
			if err != nil {
				return err
			}
			sc.SoilConfigMap[soil.Name] = soil
		}
	}
	if len(sc.SoilConfigMap) == 0 {
		return fmt.Errorf("no entries in soilConfigMap")
	}

	for i, line := range lines {
		if skipLine(line) {
			continue
		}
		l := strings.Split(line, ",")
		switch l[0] {
		case "GLOBAL_CONFIG":
			if sc.GlobalConfig, err = ParseGlobalConfig(l[1:]); err != nil {
				return err
			}
		case "ZONE":
			z, err := ParseZone(l[1:], sc.SoilConfigMap)
			if err != nil {
				return err
			}
			sc.ZoneConfigs[z.Number] = z
		case "ALGORITHM":
			sc.ETAlgorithmSimpleConfig, err = ParseETAlgorithmSimple(l[1:])
			if err != nil {
				return err
			}
		case "SOIL":
			// already processed above
		default:
			return fmt.Errorf("bad line #%d: %s", i, line)
		}
	}

	glog.Infof("ParseSystemConfig:\n%s", pretty.Sprint(*sc))
	return nil
}

// ParseGlobalConfig parses a global config slice of the following format:
// airport_code,metric_units,morning_run_time,afternoon_run_time,startup_show
func ParseGlobalConfig(line []string) (*GlobalConfig, error) {
	if len(line) != 5 {
		return nil, fmt.Errorf("GlobalConfig(%v) has %d elements, expected 5", line, len(line))
	}

	gc := &GlobalConfig{}
	var err error

	gc.AirportCode = trimS(line[0])
	layout := "15:04"
	gc.RunTimeAM, err = time.Parse(layout, trimS(line[2]))
	if err != nil {
		return nil, fmt.Errorf("GlobalConfig(%v) has bad AM value %s: %s", line, line[2], err)
	}
	gc.RunTimePM, err = time.Parse(layout, trimS(line[3]))
	if err != nil {
		return nil, fmt.Errorf("GlobalConfig(%v) has bad PM value %s: %s", line, line[3], err)
	}

	glog.Infof("ParseGlobalConfig:\n%s", pretty.Sprint(*gc))
	return gc, nil
}

// ParseZone parses a zone config slice of the following format:

// number,name,run,rain,soil_name,min_moist_pct,max_moist_pct,run_time_mult,root_depth,et_rate
//      0      1    2   3    4         5             6             7             8          9
// e.g. 2,Front & basement,1,1,Sandy Loam,25,100,1.0,16,10
func ParseZone(line []string, SoilConfigMap map[string]*SoilConfig) (*ZoneConfig, error) {
	if len(line) != 10 {
		return nil, fmt.Errorf("ZoneConfig(%v) has %d elements, expected 10", line, len(line))
	}

	zc := &ZoneConfig{}
	var err error
	var ok bool
	var n int64

	n, err = strconv.ParseInt(trimS(line[0]), 10, 32)
	if err != nil {
		return nil, fmt.Errorf("ZoneConfig(%v) has bad Number value %s: %s", line, line[0], err)
	}
	zc.Number = int(n)
	zc.Name = trimS(line[1])
	zc.Enabled, err = parseBool(trimS(line[2]))
	if err != nil {
		return nil, fmt.Errorf("ZoneConfig(%v) has bad Enabled value %s: %s", line, line[2], err)
	}
	zc.GetsRain, err = parseBool(trimS(line[3]))
	if err != nil {
		return nil, fmt.Errorf("ZoneConfig(%v) has bad GetsRain value %s: %s", line, line[3], err)
	}
	if zc.SoilConfig, ok = SoilConfigMap[trimS(line[4])]; !ok {
		return nil, fmt.Errorf("ZoneConfig(%v) has bad SoilType value %s: %s", line, line[4], err)
	}
	zc.MinVWC, err = parsePct(trimS(line[5]))
	if err != nil {
		return nil, fmt.Errorf("ZoneConfig(%v) has bad MinVWC value %s: %s", line, line[5], err)
	}
	zc.MaxVWC, err = parsePct(trimS(line[6]))
	if err != nil {
		return nil, fmt.Errorf("ZoneConfig(%v) has bad MinVWC value %s: %s", line, line[6], err)
	}
	zc.RunTimeMultiplier, err = strconv.ParseFloat(trimS(line[7]), 64)
	if err != nil || zc.RunTimeMultiplier < 0.0 {
		return nil, fmt.Errorf("ZoneConfig(%v) has bad RunTimeMultiplier value %s: %s", line, line[7], err)
	}
	zc.DepthIn, err = strconv.ParseFloat(trimS(line[8]), 64)
	if err != nil || zc.DepthIn < 0.0 {
		return nil, fmt.Errorf("ZoneConfig(%v) has bad DepthIn value %s: %s", line, line[8], err)
	}
	zc.ZoneETRate, err = parsePct(trimS(line[9]))
	if err != nil || zc.ZoneETRate < 0.0 || zc.ZoneETRate > 10.0 {
		return nil, fmt.Errorf("ZoneConfig(%v) has bad ZoneETRate value %s: %s", line, line[9], err)
	}

	glog.Infof("ParseZoneConfig:\n%s", pretty.Sprint(*zc))
	return zc, nil
}

// ParseSoilConfig parses a soil config slice of the following format:
// name,max_moist_pct
func ParseSoilConfig(line []string) (*SoilConfig, error) {
	if len(line) != 2 {
		return nil, fmt.Errorf("SoilConfig(%v) has %d elements, expected 2", line, len(line))
	}

	sc := &SoilConfig{}
	var err error

	sc.Name = trimS(line[0])
	sc.MaxVWC, err = parsePct(trimS(line[1]))
	if err != nil {
		return nil, fmt.Errorf("SoilConfig(%v) has bad pct value %s: %s", line, line[1], err)
	}

	glog.Infof("ParseSoilConfig:\n%s", pretty.Sprint(*sc))
	return sc, nil
}

// ParseETAlgorithmSimple parses a simple ET config slice of the following
// format:
// {LOW-HIGH, PERCENT_ET}+
// e.g. -50,25,50-65,50,65-75,75,75-,100
func ParseETAlgorithmSimple(line []string) (*ETAlgorithmSimple, error) {
	if len(line) == 0 {
		return nil, fmt.Errorf("ParseETAlgorithmSimple: must have at least one range")
	}
	var err error
	var X1, X2, y float64
	var ranges []Range
	for i, v := range line {
		v = strings.TrimSpace(v)
		if i%2 == 0 {
			lh := strings.Split(v, "-")
			if len(lh) != 2 {
				return nil, fmt.Errorf("ParseETAlgorithmSimple(%v) has bad range %s at index %d: %s", line, v, i, err)
			}
			if lh[0] == "" {
				X1 = NegInf
			} else {
				X1, err = strconv.ParseFloat(lh[0], 64)
				if err != nil {
					return nil, fmt.Errorf("ParseETAlgorithmSimple(%v) has bad low value %s at index %d: %s", line, lh[0], i, err)
				}
			}
			if lh[1] == "" {
				X2 = PosInf
			} else {
				X2, err = strconv.ParseFloat(lh[1], 64)
				if err != nil {
					return nil, fmt.Errorf("ParseETAlgorithmSimple(%v) has bad high value %s at index %d: %s", line, lh[1], i, err)
				}
			}
		} else {
			y, err = strconv.ParseFloat(v, 64)
			if err != nil {
				return nil, fmt.Errorf("ParseETAlgorithmSimple(%v) has bad y value %s at index %d: %s", line, v, i, err)
			}
			ranges = append(ranges, Range{X1: X1, X2: X2, Y: y})
		}
	}

	ea := &ETAlgorithmSimple{
		EtPctMap: NewRangeMapper(ranges),
	}
	glog.Infof("ParseETAlgorithmSimple:\n%s", ea.EtPctMap)
	return ea, nil
}

// parsePct parses a string that represents a floating point percentage.
func parsePct(v string) (Pct, error) {
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return 0.0, err
	}
	if f < 0 || f > 100.0 {
		return 0.0, fmt.Errorf("percent must be in the range 0-100, got %f", f)
	}
	return Pct(f), nil
}

// parseBool parses a string that has an integer value that represents boolean
// where 0->false and 1->true.
func parseBool(v string) (bool, error) {
	n, err := strconv.ParseInt(v, 10, 32)
	if err != nil {
		return false, err
	}
	switch n {
	case 0:
		return false, nil
	case 1:
		return true, nil
	}
	return false, fmt.Errorf("bool value should be 0 or 1, got %d", n)
}

// skipLine reports whether the config line should be skipped.
func skipLine(line string) bool {
	return len(line) == 0 || strings.HasPrefix(line, "#") || len(strings.Split(line, ",")) == 0
}
