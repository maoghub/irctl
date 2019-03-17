package control

import (
	"fmt"
	"time"

	log "github.com/golang/glog"
)

const (
	pctPerPrecipIn     = 100.0
	nominalDepthIn     = 8.0
	nominalRunTimeMin  = 10.0
	nominalVWCIncrease = 20.0
	minsPerInPerPct    = nominalRunTimeMin / (nominalDepthIn * nominalVWCIncrease)
)

var (
	growthFactor = map[time.Month]float64{
		time.January:   0.5,
		time.February:  0.7,
		time.March:     1.0,
		time.April:     1.0,
		time.May:       1.0,
		time.June:      1.0,
		time.July:      1.0,
		time.August:    1.0,
		time.September: 1.0,
		time.October:   0.7,
		time.November:  0.7,
		time.December:  0.5,
	}
)

// Pct is a float percentage between 0.0 and 100.0.
type Pct float64

// ToRatio returns a ratio between 0.0 and 1.0 corresponding to p, where 100.0
// returns 1.0.
func (p Pct) ToRatio() float64 {
	return float64(p) / 100.0
}

// min returns the minimum of a and b.
func min(a, b Pct) Pct {
	if a < b {
		return a
	}
	return b
}

// min returns the maximum of a and b.
func max(a, b Pct) Pct {
	if a > b {
		return a
	}
	return b
}

// ETAlgorithm is an ET algorithm.
type ETAlgorithm interface {
	// CalculateVWC returns a new VWC, given the previous day's VWC, temp and
	// precip.
	CalculateVWC(currentVWC Pct, tempF, precipIn float64, now time.Time, zconf *ZoneConfig) (Pct, error)
	// CalculateRuntime returns a run time duration to increase VWC from fromVWC
	// to toVWC, given the forecast precip amount.
	CalculateRuntime(fromVWC, toVWC Pct, forecastPrecipIn float64, zconf *ZoneConfig) (time.Duration, error)
}

// ETAlgorithmSimple is a simple linear ET model.
type ETAlgorithmSimple struct {
	EtPctMap *RangeMapper
}

// NewETAlgorithmSimple returns a new ETAlgorithmSimple given a RangeMapper,
// which maps a temp to % of ET maximum for the zone.
func NewETAlgorithmSimple(r *RangeMapper) *ETAlgorithmSimple {
	return &ETAlgorithmSimple{
		EtPctMap: r,
	}
}

// CalculateVWC implements ETAlgorithm#CalculateVWC method.
func (e *ETAlgorithmSimple) CalculateVWC(currentVWC Pct, tempF, precipIn float64, now time.Time, zconf *ZoneConfig) (Pct, error) {
	remove := Pct(e.etPct(tempF) * zconf.ZoneETRate * growthFactor[now.Month()])
	add := Pct(precipIn * pctPerPrecipIn)
	log.Infof("etPct=%f, ZoneETRate=%f, growthFactor=%f, removePct=%f, addPct=%f\n", e.etPct(tempF), zconf.ZoneETRate, growthFactor[now.Month()], remove, add)
	return min(max(0, currentVWC+add-remove), zconf.MaxVWC), nil
}

// CalculateRuntime implements ETAlgorithm#CalculateRuntime method.
func (e *ETAlgorithmSimple) CalculateRuntime(currentVWC, targetVWC Pct, forecastPrecipIn float64, zconf *ZoneConfig) (time.Duration, error) {
	precipVWC := Pct(forecastPrecipIn * pctPerPrecipIn)
	addVWC := float64(max(0, targetVWC-currentVWC-precipVWC))
	return time.Duration((addVWC/nominalVWCIncrease)*(zconf.DepthIn/nominalDepthIn)*nominalRunTimeMin) * time.Minute, nil
}

// etPct returns an ET percentage for the given temp.
func (e *ETAlgorithmSimple) etPct(tempF float64) float64 {
	return e.EtPctMap.GetY(tempF)
}

// Range is a range of x values that map to a given y value.
type Range struct {
	X1 float64
	X2 float64
	Y  float64
}

// RangeMapper maps x to y values, given a list of Ranges.
type RangeMapper struct {
	R []Range
}

// NewRangeMapper returns a RangeMapper ptr, initialized with the given ranges
// r.
func NewRangeMapper(r []Range) *RangeMapper {
	return &RangeMapper{
		R: r,
	}
}

// GetY returns the y value for the given x value. Returns 0 if x is outside of
// any defined range. Results are undefined if ranges overlap.
func (rm *RangeMapper) GetY(x32 float64) float64 {
	x := float64(x32)
	for _, r := range rm.R {
		if x >= r.X1 && x < r.X2 {
			return r.Y
		}
	}
	return 0
}

// String returns a string representation of rm.
func (rm *RangeMapper) String() string {
	out := "{"
	for i, r := range rm.R {
		if i != 0 {
			out += ", "
		}
		out += fmt.Sprintf("[%3.2f-%3.2f, %3.2f]", r.X1, r.X2, r.Y)
	}
	return out + "}"
}

/*
type PlantHeight int

const (
	Short PlantHeight = iota
	Tall
)


// ETAlgorithmPenMon is a Penman-Monteith ET model.
type ETAlgorithmPenMon struct {
	latitude    float64
	longitude   float64
	avgPressure float64
	cd          map[PlantHeight][bool]float64
	cn          map[PlantHeight][bool]float64
}

func NewETAlgorithmPenMon(latitude, longitude, avgPressure float64) *ETAlgorithmPenMon {
	return &ETAlgorithmPenMon{
		latitude:    latitude,
		longitude:   longitude,
		avgPressure: avgPressure,
		cd: map[PlantHeight][bool]float64{
			Short: map[bool]float64{
				true:  0.24,
				false: 0.96,
			},
			Tall: map[bool]float64{
				true:  0.25,
				false: 1.7,
			},
		},
		cn: map[PlantHeight][bool]float64{
			Short: map[bool]float64{
				true:  37,
				false: 37,
			},
			Tall: map[bool]float64{
				true:  66,
				false: 66,
			},
		},
	}
}

func (a *ETAlgorithmPenMon) Et(height PlantHeight, tempAvg, rh, windAt2m, pressure float64) float64 {
	t := tempAvg
	doy := time.Now().Day()
	numHrs := 1.0
	G := 0.0
	et := 0.0
	u2 := windAt2m

	for hr:= 0; hr < 24; hr++ {
		et +=  (0.408*a.delta(tempAvg)*(a.Rn(doy, numHrs, tempAvg, rh)-G) +
		a.gamma(pressure)*a.Cn(height, hr)/(t+273)*u2*(a.es(tempAvg)-ea(tempAvg, rh))) /
		(a.delta(t) + a.gamma*(1+a.cd(height, hr)*u2))
	}
}

func (a *ETAlgorithmPenMon) delta(temp float64) float64 {
	return 2504.0 * math.Exp(17.27*temp/(temp+237.3)) / math.Powpow(temp+237.3, 2.0)
}

func (a *ETAlgorithmPenMon) gamma(pressure float64) float64 {
	return 0.000665 * pressure
}

func (a *ETAlgorithmPenMon) cd(height PlantHeight, hourOfDay int) float64 {
	return a.cd(height, isDaytime(hourOfDay))
}

func (a *ETAlgorithmPenMon) cn(height PlantHeight, hourOfDay int) float64 {
	return a.cn(height, isDaytime(hourOfDay))
}

func (a *ETAlgorithmPenMon) es(temp float64) float64 {
	return a.e0(temp)
}

func (a *ETAlgorithmPenMon) ea(temp, rh float64, float Rh) float64 {
	return Rh / 100.0 * e0(T)
}

func (a *ETAlgorithmPenMon) e0(temp float64) float64 {
	return 0.6108 * math.Exp(17.27*temp/(temp+237.3))
}

func (a *ETAlgorithmPenMon) ws(dayOfYear int) float64 {
	return math.Acos(-1.0 * math.Tan(degToRadians(a.latitude)) * math.Tan(a.declination(dayOfYear)))
}

func (a *ETAlgorithmPenMon) declination(dayOfYear int) float64 {
	return 0.409 * math.Sin(2.0*math.Pi*dayOfYear/365.0-1.39)
}

func (a *ETAlgorithmPenMon) w(dayOfYear, numHrs int) float64 {

	return math.Pi / 12.0 * (numHrs + 0.06667*((120-a.longitude)+Sc(dayOfYear)) - 12.0)

}

func (a *ETAlgorithmPenMon) Sc(dayOfYear int) float64 {
	b := 2.0 * math.Pi * (dayOfYear - 81.0) / 364.0
	return 0.1645*math.Sin(2.0*b) - 0.1255*math.Cos(b) - 0.025*math.Sin(b)
}

func (a *ETAlgorithmPenMon) Rn(dayOfYear, hourOfDay, numHrs int, temp, rh float64) float64 {
	return a.Rns(dayOfYear, hourOfDay, numHrs) - a.Rnl(dayOfYear, hourOfDay, numHrs, temp, rh)
}

func (a *ETAlgorithmPenMon) Rns(dayOfYear, hourOfDay, numHrs int) float64 {
	return (1.0 - albedo) * a.Rs(dayOfYear, numHrs)
}

func (a *ETAlgorithmPenMon) Rs(dayOfYear, numHrs int) float64 {
	return 1000.0 // derive from CIMIS data or measure
}

func (a *ETAlgorithmPenMon) Rnl(dayOfYear, hourOfDay, numHrs int, temp, rh float64) float64 {
	return 4.901e-9 * math.Pow(T, 4.0) *
		(0.34 - 0.14*math.Sqrt(a.ea(temp, rh))) *
		(1.35*a.Rs(dayOfYear, numHrs)/a.Rs0(dayOfYear, hourOfDay, numHrs) - 0.35)
}

func (a *ETAlgorithmPenMon) Rs0(dayOfYear, hourOfDay, numHrs int) float64 {
	myHeight := 0.0
	return (0.75 + myHeight*2.0e-5) * a.Ra(dayOfYear, hourOfDay, numHrs)
}

func (a *ETAlgorithmPenMon) Ra(dayOfYear, hourOfDay, numHrs int) float64 {
	EtCalcHrs := 1.0
	phi := degToRadians(a.latitude)
	d := declination(dayOfYear)
	w1 := w(numHrs) - math.Pi*EtCalcHrs/24.0
	w2 := w(numHrs) + math.Pi*EtCalcHrs/24.0
	wS := ws(dayOfYear)

	w1 = max(w1, -1.0*wS)
	w2 = max(w2, -1.0*wS)
	w1 = min(w1, wS)
	w2 = min(w2, wS)
	w1 = min(w1, w2)

	return 12.0 / math.Pi * 4.92 * a.dr(dayOfYear) * ((w2-w1)*math.Sin(phi)*math.Sin(d) +
		math.cos(phi)*math.cos(d)*(math.sin(w2)-math.sin(w1)))
}

func (a *ETAlgorithmPenMon) dr(dayOfYear int) float64 {
	return 1.0 + 0.033*math.Cos(2.0*math.Pi*dayOfYear/365.0)
}

func isDaytime(hourOfDay int, sunrise, sunset time.Time) bool {
	return hourOfDay >= sunrise.Hour() && hourOfDay <= sunset.Hour()
}

func degToRadians(deg float64) float64 {
	return deg /180.0 * math.Pi
}

func max(a, b float64) float64 {
	if a < b {
		return b
	}
	return a
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

*/
