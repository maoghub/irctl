package control

import (
	//"encoding/json"
	"reflect"
	"testing"
	"time"

	"github.com/kylelemons/godebug/pretty"
)

func errToString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func TestParsePct(t *testing.T) {
	tests := []struct {
		desc    string
		in      string
		want    Pct
		wantErr string
	}{
		{
			desc: "success",
			in:   "50",
			want: 50.0,
		},
		{
			desc:    "error -ve",
			in:      "-50",
			wantErr: `percent must be in the range 0-100, got -50.000000`,
		},
		{
			desc:    "error too large",
			in:      "102.0",
			wantErr: `percent must be in the range 0-100, got 102.000000`,
		},
	}
	for _, tt := range tests {
		v, err := parsePct(tt.in)
		if got, want := errToString(err), tt.wantErr; got != want {
			t.Errorf("%s: got error: %s, want error: %s", tt.desc, got, want)
		}
		if got, want := v, tt.want; got != want {
			t.Errorf("%s: got: %v, want: %v", tt.desc, got, want)
		}
	}

}

func TestParseBool(t *testing.T) {
	tests := []struct {
		desc    string
		in      string
		want    bool
		wantErr string
	}{
		{
			desc: "success false",
			in:   "0",
			want: false,
		},
		{
			desc: "success true",
			in:   "1",
			want: true,
		},
		{
			desc:    "bad val",
			in:      "abc",
			wantErr: `strconv.ParseInt: parsing "abc": invalid syntax`,
		},
		{
			desc:    "too large",
			in:      "2",
			wantErr: `bool value should be 0 or 1, got 2`,
		},
	}
	for _, tt := range tests {
		v, err := parseBool(tt.in)
		if got, want := errToString(err), tt.wantErr; got != want {
			t.Errorf("%s: got error: %s, want error: %s", tt.desc, got, want)
		}
		if got, want := v, tt.want; got != want {
			t.Errorf("%s: got: %v, want: %v", tt.desc, got, want)
		}
	}

}

func TestReadConfig(t *testing.T) {
	goodConfig := `
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

#e.g ALGORITHM,-50,25,50-65,50,65-75,75,75-,100
ALGORITHM,-50,25,50-65,50,65-75,75,75-,100
`
	got := &SystemConfig{}
	err := got.Parse(goodConfig)
	if err != nil {
		t.Fatalf("ReadSystemConfig error: %s", err)
	}

	wantXY := []Range{
		{X1: NegInf, X2: 50.0, Y: 25.0},
		{X1: 50, X2: 65.0, Y: 50.0},
		{X1: 65.0, X2: 75.0, Y: 75.0},
		{X1: 75.0, X2: PosInf, Y: 100.0},
	}
	layout := "15:04"
	wantTimeAM, _ := time.Parse(layout, "9:00")
	wantTimePM, _ := time.Parse(layout, "16:00")
	wantSoilConfigMap := map[string]*SoilConfig{
		"Loam":       {Name: "Loam", MaxVWC: 40.0},
		"Clay":       {Name: "Clay", MaxVWC: 50.0},
		"Sandy Loam": {Name: "Sandy Loam", MaxVWC: 30.0},
	}
	want := &SystemConfig{
		ETAlgorithmSimpleConfig: &ETAlgorithmSimple{
			EtPctMap: NewRangeMapper(wantXY),
		},
		GlobalConfig: &GlobalConfig{
			AirportCode: "KSJC",
			RunTimeAM:   wantTimeAM,
			RunTimePM:   wantTimePM,
		},
		SoilConfigMap: wantSoilConfigMap,
		ZoneConfigs: map[int]*ZoneConfig{
			0: {
				Name:              "zone 0",
				Number:            0,
				Enabled:           true,
				GetsRain:          true,
				SoilConfig:        wantSoilConfigMap["Loam"],
				MinVWC:            10.0,
				MaxVWC:            20.0,
				RunTimeMultiplier: 1.0,
				DepthIn:           8.0,
				ZoneETRate:        1.0,
			},
			1: {
				Name:              "zone 1",
				Number:            1,
				Enabled:           true,
				GetsRain:          false,
				SoilConfig:        wantSoilConfigMap["Clay"],
				MinVWC:            11.0,
				MaxVWC:            21.0,
				RunTimeMultiplier: 2.0,
				DepthIn:           9.0,
				ZoneETRate:        2.0,
			},
			2: {
				Name:              "zone 2",
				Number:            2,
				Enabled:           false,
				GetsRain:          true,
				SoilConfig:        wantSoilConfigMap["Sandy Loam"],
				MinVWC:            12.0,
				MaxVWC:            22.0,
				RunTimeMultiplier: 3.0,
				DepthIn:           11.0,
				ZoneETRate:        3.0,
			},
		},
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ReadSystemConfig: got:\n%s\n\n, want:\n%s\n", pretty.Sprint(got), pretty.Sprint(want))
	}

	/*
		j, err := json.Marshal(want)//json.MarshalIndent(want, "", "  ")
		if err != nil {
			t.Fatal(err)
		}
	*/
}
