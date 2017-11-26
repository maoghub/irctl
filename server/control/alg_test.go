package control

import (
	"strings"
	"testing"
	"time"
)

func TestRangeMapper(t *testing.T) {
	tests := []struct {
		algStr  string
		x       []float64
		want    []float64
		wantErr string
	}{
		{
			algStr:  ``,
			wantErr: `ParseETAlgorithmSimple: must have at least one range`,
		},
		{
			algStr:  `abc`,
			wantErr: `ParseETAlgorithmSimple([abc]) has bad range abc at index 0: %!s(<nil>)`,
		},
		{
			algStr:  `a-b`,
			wantErr: `ParseETAlgorithmSimple([a-b]) has bad low value a at index 0: strconv.ParseFloat: parsing "a": invalid syntax`,
		},
		{
			algStr: `-50, 0, 75-, 1`,
			x:      []float64{-100, 0, 10, 55, 74.9, 120, 200},
			want:   []float64{0, 0, 0, 0, 0, 1, 1},
		},
		{
			algStr: `-50,25,50-65,50,65-75,75,75-,100`,
			x:      []float64{-100, 0, 10, 55, 74.9, 120, 200},
			want:   []float64{25, 25, 25, 50, 75, 100, 100},
		},
	}

	for idx, tt := range tests {
		algV := strings.Split(tt.algStr, ",")
		if tt.algStr == "" {
			algV = nil
		}
		alg, err := ParseETAlgorithmSimple(algV)
		if got, want := errToString(err), tt.wantErr; got != want {
			t.Errorf("%d: got error %s, want error: %s", idx, got, want)
			continue
		}
		if tt.wantErr != "" {
			continue
		}

		for j := range tt.x {
			if got, want := alg.EtPctMap.GetY(tt.x[j]), tt.want[j]; got != want {
				t.Errorf("#%d x=%f: got %f, want: %f", idx, tt.x[j], got, want)
			}
		}
	}
}

func TestETAlgorithmSimpleCalculateVWC(t *testing.T) {
	defaultAlgStr := `ALGORITHM,-50,25,50-65,50,65-75,75,75-,100`
	testConfig := `
GLOBAL_CONFIG,KSJC,0,9:00,16:00,0
#ZONE,number,name,run,rain,soil_name,min_moist_pct,max_moist_pct,run_time_mult,root_depth,et_rate
ZONE,0,zone 0,1,1,Loam,10,20,1.0,8.0,1.0
SOIL,Loam,40.0	
`

	tests := []struct {
		algStr   string
		inTemp   float64
		inPrecip float64
		inVWC    Pct
		want     Pct
	}{
		{inTemp: 80, inVWC: 15, want: 8},
		{inTemp: 80, inVWC: 15, inPrecip: 0.1, want: 18},
		{inTemp: 80, inVWC: 15, inPrecip: 10, want: 20},
		{inTemp: 80, inVWC: 5, want: 0},
		{inTemp: 20, inVWC: 15, want: 13.25},
	}

	for idx, tt := range tests {
		sc := &SystemConfig{}
		algStr := tt.algStr
		if algStr == "" {
			algStr = defaultAlgStr
		}
		if err := sc.Parse(testConfig + algStr); err != nil {
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
	defaultAlgStr := `ALGORITHM,-50,25,50-65,50,65-75,75,75-,100`
	testConfig := `
GLOBAL_CONFIG,KSJC,0,9:00,16:00,0
#ZONE,number,name,run,rain,soil_name,min_moist_pct,max_moist_pct,run_time_mult,root_depth,et_rate
ZONE,0,zone 0,1,1,Loam,10,20,1.0,8.0,1.0
SOIL,Loam,40.0	
`

	tests := []struct {
		algStr         string
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
		algStr := tt.algStr
		if algStr == "" {
			algStr = defaultAlgStr
		}
		if err := sc.Parse(testConfig + algStr); err != nil {
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
