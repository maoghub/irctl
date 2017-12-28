package control

import (
	"testing"
	"time"
)

var	testConfig =`
{
  "ETAlgorithmSimpleConfig": {
    "EtPctMap": {
      "R": [
        {
          "X1": -999,
          "X2": 50,
          "Y": 2.5
        },
        {
          "X1": 50,
          "X2": 65,
          "Y": 5.0
        },
        {
          "X1": 65,
          "X2": 75,
          "Y": 7.5
        },
        {
          "X1": 75,
          "X2": 999,
          "Y": 10.0
        }
      ]
    }
  },
  "GlobalConfig": {
    "AirportCode": "KSJC",
    "RunTimeAM": "0000-01-01T09:00:00Z"
  },
  "ZoneConfigs": {
    "0": {
      "DepthIn": 8,
      "Enabled": true,
      "GetsRain": true,
      "MaxVWC": 20,
      "MinVWC": 10,
      "Name": "zone 0",
      "Number": 0,
      "RunTimeMultiplier": 1,
      "SoilConfig": {
        "MaxVWC": 40,
        "Name": "Potting Mix"
      },
      "ZoneETRate": 0.1
    }
  }
}
`

func TestETAlgorithmSimpleCalculateVWC(t *testing.T) {
	tests := []struct {
		inTemp   float64
		inPrecip float64
		inVWC    Pct
		want     Pct
	}{
		{inTemp: 80, inVWC: 15, want: 10},
		{inTemp: 80, inVWC: 15, inPrecip: 0.1, want: 20},
		{inTemp: 80, inVWC: 15, inPrecip: 10, want: 20},
		{inTemp: 80, inVWC: 5, want: 0},
		{inTemp: 20, inVWC: 15, want: 13.75},
	}

	for idx, tt := range tests {
		sc := &SystemConfig{}
		if err := sc.Parse(testConfig); err != nil {
			t.Fatal(err)
		}

		alg := NewETAlgorithmSimple(sc.ETAlgorithmSimpleConfig.EtPctMap)
		newVWC, err := alg.CalculateVWC(tt.inVWC, tt.inTemp, tt.inPrecip, time.Now(), sc.ZoneConfigs[0])
		if err != nil {
			t.Fatal(err)
		}

		if got, want := newVWC, tt.want; got != want {
			t.Errorf("%d: got %f, want: %f", idx, got, want)
		}
	}
}

func TestETAlgorithmSimpleCalculateRuntime(t *testing.T) {
	tests := []struct {
		curVWC         Pct
		targetVWC      Pct
		forecastPrecip float64
		want           int
	}{
		{curVWC: 15, targetVWC: 20, want: 2},
		{curVWC: 10, targetVWC: 20, want: 5},
		{curVWC: 10, targetVWC: 20, forecastPrecip: 0.01, want: 4},
		{curVWC: 10, targetVWC: 20, forecastPrecip: 10, want: 0},
	}

	for idx, tt := range tests {
		sc := &SystemConfig{}
		if err := sc.Parse(testConfig); err != nil {
			t.Fatal(err)
		}

		alg := NewETAlgorithmSimple(sc.ETAlgorithmSimpleConfig.EtPctMap)
		duration, err := alg.CalculateRuntime(tt.curVWC, tt.targetVWC, tt.forecastPrecip, sc.ZoneConfigs[0])
		if err != nil {
			t.Fatal(err)
		}

		if got, want := duration, time.Duration(tt.want)*time.Minute; got != want {
			t.Errorf("%d: got %s, want: %s", idx, got, want)
		}
	}
}
