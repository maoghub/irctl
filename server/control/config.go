package control

import (
	"encoding/json"
	"fmt"
	"time"
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
	ZoneETRate        float64
	DepthIn           float64
}

// SoilConfig is the config for soils.
type SoilConfig struct {
	Name   string
	MaxVWC Pct
}

// Parse parses a configuration text block and populates sc with the parsed
// values.
func (sc *SystemConfig) Parse(conf string) error {
	if err := json.Unmarshal([]byte(conf), sc); err != nil {
		return err
	}

	if sc.ETAlgorithmSimpleConfig == nil {
		return fmt.Errorf("must specify algorithm")		
	}
	
	if sc.GlobalConfig == nil {
		return fmt.Errorf("must specify GlobalConfig")
	}

	if sc.GlobalConfig.AirportCode == "" {
		return fmt.Errorf("must specify AirportCode")
	}

	if len(sc.ZoneConfigs) == 0 {
		return fmt.Errorf("must specify at least one zone")
	}

	numMap := make(map[int]bool)
	for _, zc := range sc.ZoneConfigs {
		if numMap[zc.Number] {
			return fmt.Errorf("duplicate zone number %d for name %s", zc.Number, zc.Name)
		}
		numMap[zc.Number] = true

		if err := verifyZoneConfig(zc); err != nil {
			return err
		}
	}
	
	return nil
}

func verifyZoneConfig(zc *ZoneConfig) error {
	if zc.Name == "" {
		return fmt.Errorf("must specify zone name for zone number %d", zc.Number)
	}

	if zc.Number < 0 {
		return fmt.Errorf("zone number %d cannot be negative", zc.Number)
	}

	if zc.MaxVWC < 0 || zc.MaxVWC > 100.0 {
		return fmt.Errorf("zone %d:%s MaxVWC must be in the range 0-100, have %.3f", zc.Number, zc.Name, zc.MaxVWC)
	}

	if zc.MinVWC < 0 || zc.MinVWC > 100.0 {
		return fmt.Errorf("zone %d:%s MinVWC must be in the range 0-100, have %.3f", zc.Number, zc.Name, zc.MinVWC)
	}

	if zc.DepthIn < 1.0 {
		return fmt.Errorf("zone %d:%s MinVWC must be > 1.0 have %.3f", zc.Number, zc.Name, zc.DepthIn)
	}

	if zc.ZoneETRate < 0.01 || zc.ZoneETRate > 1.0 {
		return fmt.Errorf("zone %d:%s ZoneETRate must be in the range 0.01 - 1.0, have %.3f", zc.Number, zc.Name, zc.ZoneETRate)
	}

	if zc.RunTimeMultiplier < 0.1 || zc.RunTimeMultiplier > 10.0 {
		return fmt.Errorf("zone %d:%s RunTimeMultiplier must be in the range 0.1 - 10.0, have %.3f", zc.Number, zc.Name, zc.RunTimeMultiplier)
	}

	return nil
}
