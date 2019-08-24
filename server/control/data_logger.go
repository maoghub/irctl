package control

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"time"

	log "github.com/golang/glog"
)

const (
	// conditionsSubdir is subdir where condition logs are written.
	conditionsSubdir = "conditions"
	// runtimesSubdir is subdir where runtimes are written.
	runtimesSubdir = "runtimes"
	// logFileExtension is filename extension for log files.
	logFileExtension = ".log"
)

// NewDataLogger returns a ptr to an intializes DataLogger.
func NewDataLogger(rootPath string) *DataLogger {
	return &DataLogger{
		root: rootPath,
	}
}

// DataLogger is a logger for conditions and runtimes.
type DataLogger struct {
	root string
}

// ConditionsEntry is an entry for the conditions log.
type ConditionsEntry struct {
	Date   time.Time
	Icon   string
	Temp   float64
	Precip float64
}

// WriteConditions writes the given conditions to a file that is determined by
// the logger root and the date portion of Time t,
//  e.g. ../data/conditions/2017/12/26.log
func (l *DataLogger) WriteConditions(t time.Time, iconStr string, tempStr, precipStr float64) error {
	// For some reason, older conditions entries have an unknown icon. This applies to days
	// that have already been written so it's ok to skip.
	if iconStr == "unknown" {
		return nil
	}
	fp := l.conditionsFilePath(t)
	if err := createDirIfMissing(fp); err != nil {
		return err
	}
	ce := &ConditionsEntry{
		Date:   dateOnly(t),
		Icon:   iconStr,
		Temp:   tempStr,
		Precip: precipStr,
	}
	//	logStr := fmt.Sprintf("%s,%s,%.1f,%.2f", t.Format("2006-01-02"), iconStr, tempStr, precipStr)
	j, err := json.Marshal(ce)
	if err != nil {
		return err
	}
	if err := ioutil.WriteFile(fp, j, 0644); err != nil {
		return err
	}
	log.Infof("WriteConditions for %s : %s", ce.Date, string(j))
	return nil
}

// ReadConditions reads conditions from files that is determined by the logger
// root and the date portions of the date range "from"-"to". Any entries that
// cannot be read result in errors being appended to the returned Errors.
func (l *DataLogger) ReadConditions(from, to time.Time) ([]*ConditionsEntry, Errors) {
	log.Infof("ReadConditions: %s to %s", dateStr(from), dateStr(to))
	now := dateOnly(from)
	after := dateOnly(to.AddDate(0, 0, 1))
	var out []*ConditionsEntry
	var errs Errors
	for now.Before(after) {
		c, err := l.readConditionsOneDay(now)
		if err != nil {
			errs = AppendErr(errs, err)
		} else {
			out = append(out, c)
		}
		now = now.AddDate(0, 0, 1)
	}
	return out, errs
}

// ReadMostRecentConditions returns the most recently written conditions value, going
// up to a month into the past.
func (l *DataLogger) ReadMostRecentConditions(t time.Time) (temp, precip float64) {
	now := dateOnly(t)
	c, err := l.readConditionsOneDay(now)
	for maxDays := 30; err != nil && maxDays > 0; maxDays-- {
		now.AddDate(0, 0, -1)
		c, err = l.readConditionsOneDay(now)
	}
	if err != nil {
		// return some "reasonable number".
		log.Error("Unable to read any past values, using 70degF, no rain!")
		return 70.0, 0.0
	}
	return c.Temp, c.Precip
}

// readConditionsOneDay reads conditions for one day with the date in t.
func (l *DataLogger) readConditionsOneDay(t time.Time) (*ConditionsEntry, error) {
	log.Infof("readConditionsOneDay: %s", dateStr(t))
	j, err := ioutil.ReadFile(l.conditionsFilePath(t))
	if err != nil {
		return nil, fmt.Errorf("ReadFile: %s", err)
	}

	ce := &ConditionsEntry{}
	if err := json.Unmarshal(j, ce); err != nil {
		return nil, fmt.Errorf("Unmarshal: %s : %s", j, err)
	}
	return ce, nil
}

// conditionsFilePath returns the file path for log entry with the date in t.
func (l *DataLogger) conditionsFilePath(t time.Time) string {
	return filepath.Join(l.root, conditionsSubdir, fmt.Sprint(t.Year()), fmt.Sprint(int(t.Month())), fmt.Sprint(t.Day())+logFileExtension)
}

// RuntimesEntry is a log entry for runtimes.
type RuntimesEntry struct {
	Date     time.Time
	Runtimes []float64
}

// WriteRuntimes writes the given runtimes to a file that is determined by
// the logger root and the date portion of Time t,
//  e.g. ../data/conditions/2017/12/26.log
func (l *DataLogger) WriteRuntimes(t time.Time, numZones int, runtimesMap map[int]time.Duration) error {
	fp := l.runtimesFilePath(t)
	if err := createDirIfMissing(fp); err != nil {
		return err
	}

	// Log format is slice of minutes.
	runtimes := make([]float64, numZones)
	for znum := 0; znum < numZones; znum++ {
		if rt, ok := runtimesMap[znum]; ok {
			runtimes[znum] = rt.Minutes()
		}
	}

	j, err := json.Marshal(RuntimesEntry{dateOnly(t), runtimes})
	if err != nil {
		return err
	}
	if err := ioutil.WriteFile(fp, j, 0644); err != nil {
		return err
	}
	log.Infof("WriteRuntimes for %s : %s", dateOnly(t), string(j))
	return nil
}

// ReadRuntimes reads runtimes from files that is determined by the logger
// root and the date portions of the date range "from"-"to". Any entries that
// cannot be read result in errors being appended to the returned Errors.
func (l *DataLogger) ReadRuntimes(from, to time.Time) ([]*RuntimesEntry, Errors) {
	now := dateOnly(from)
	after := dateOnly(to.AddDate(0, 0, 1))
	var out []*RuntimesEntry
	var errs Errors
	for now.Before(after) {
		r, err := l.readRuntimesOneDay(now)
		if err != nil {
			errs = AppendErr(errs, err)
		} else {
			out = append(out, r)
		}
		now = now.AddDate(0, 0, 1)
	}
	return out, errs
}

// readRuntimesOneDay reads runtimes for one day with the date in t.
func (l *DataLogger) readRuntimesOneDay(t time.Time) (*RuntimesEntry, error) {
	j, err := ioutil.ReadFile(l.runtimesFilePath(t))
	if err != nil {
		return nil, fmt.Errorf("ReadFile: %s", err)
	}

	var rts *RuntimesEntry
	if err := json.Unmarshal(j, &rts); err != nil {
		return nil, fmt.Errorf("Unmarshal: %s : %s", j, err)
	}
	return rts, nil
}

// runtimesFilePath returns the file path for runtimes log entry with the date
// in t.
func (l *DataLogger) runtimesFilePath(t time.Time) string {
	return filepath.Join(l.root, runtimesSubdir, fmt.Sprint(t.Year()), fmt.Sprint(int(t.Month())), fmt.Sprint(t.Day())+logFileExtension)
}

// createDirIfMissing creates a dir for the given filepath if it is missing.
func createDirIfMissing(filePath string) error {
	dirPath, _ := filepath.Split(filePath)
	//fmt.Printf("making dir %s\n", dirPath)
	return os.MkdirAll(dirPath, 0777)
}

// dateOnly returns t with all non-date fields set to zero.
func dateOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// dateStr returns a JS type of date string representation i.e. YYYY-MM-DD.
func dateStr(t time.Time) string {
	return fmt.Sprintf("%d-%d-%d", t.Year(), t.Month(), t.Day())
}
