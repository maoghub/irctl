package control

import (
	"testing"
)

func TestSystemConfigParse(t *testing.T) {
	tests := []struct {
		desc      string
		configStr string
		wantErr   string
	}{
		{
			desc: "good",
			configStr: `
{
  "ETAlgorithmSimpleConfig": {
    "EtPctMap": {
      "R": [
        {
          "X1": -999,
          "X2": 999,
          "Y": 10
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
`,
		},
		{
			desc:    "missing algorithm",
			wantErr: `must specify algorithm`,
			configStr: `
{
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
`,
		},
		{
			desc:    "missing GlobalConfig",
			wantErr: `must specify GlobalConfig`,
			configStr: `
{
  "ETAlgorithmSimpleConfig": {
    "EtPctMap": {
      "R": [
        {
          "X1": -999,
          "X2": 999,
          "Y": 10
        }
      ]
    }
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
`,
		},
		{
			desc:    "missing ET rate",
			wantErr: `zone 0:zone 0 ZoneETRate must be in the range 0.01 - 1.0, have 0.000`,
			configStr: `
{
  "ETAlgorithmSimpleConfig": {
    "EtPctMap": {
      "R": [
        {
          "X1": -999,
          "X2": 999,
          "Y": 10
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
      }
    }
  }
}			
`,
		},
		{
			desc:    "duplicate number",
			wantErr: `duplicate zone number 0 for name zone 0`,
			configStr: `
{
  "ETAlgorithmSimpleConfig": {
    "EtPctMap": {
      "R": [
        {
          "X1": -999,
          "X2": 999,
          "Y": 10
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
      "ZoneETRate": 0.1
    },
    "1": {
      "DepthIn": 8,
      "Enabled": true,
      "GetsRain": true,
      "MaxVWC": 20,
      "MinVWC": 10,
      "Name": "zone 0",
      "Number": 0,
      "RunTimeMultiplier": 1,
      "ZoneETRate": 0.1
    }
  }
}			
`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var sc SystemConfig
			err := sc.Parse(tt.configStr)
			if got, want := errToString(err), tt.wantErr; got != want {
				t.Errorf("%s: got error: %s, want error: %s", tt.desc, got, want)
			}
		})
	}
}
