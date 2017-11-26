package control

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"time"
)

const (
	conditionsSubdir = "conditions"
	runtimesSubdir   = "runtimes"
	logFileExtension = ".log"
)

func NewDataLogger(log Logger, rootPath string, numZones int) *DataLogger {
	return &DataLogger{
		log:      log,
		root:     rootPath,
		numZones: numZones,
	}
}

type DataLogger struct {
	log      Logger
	root     string
	numZones int
}

type ConditionsEntry struct {
	Date   time.Time
	Icon   string
	Temp   float64
	Precip float64
}

func (l *DataLogger) WriteConditions(t time.Time, iconYesterday string, tempYesterday, precipYesterday float64) error {
	fp := l.conditionsFilePath(t)
	if err := createDirIfMissing(fp); err != nil {
		return err
	}
	ce := &ConditionsEntry{
		Date:   dateOnly(t),
		Icon:   iconYesterday,
		Temp:   tempYesterday,
		Precip: precipYesterday,
	}
	//	logStr := fmt.Sprintf("%s,%s,%.1f,%.2f", t.Format("2006-01-02"), iconYesterday, tempYesterday, precipYesterday)
	j, err := json.Marshal(ce)
	if err != nil {
		return err
	}
	if err := ioutil.WriteFile(fp, j, 0644); err != nil {
		return err
	}
	l.log.Infof("WriteConditions for %s : %s\n", ce.Date, string(j))
	return nil
}

func (l *DataLogger) ReadConditions(from, to time.Time) []*ConditionsEntry {
	now := dateOnly(from)
	after := dateOnly(to.AddDate(0, 0, 1))
	var out []*ConditionsEntry
	for now.Before(after) {
		c := l.readConditionsOneDay(now)
		out = append(out, c)
		now = now.AddDate(0, 0, 1)
	}
	return out
}

func (l *DataLogger) readConditionsOneDay(t time.Time) *ConditionsEntry {
	j, err := ioutil.ReadFile(l.conditionsFilePath(t))
	if err != nil {
		l.log.Errorf(err.Error())
		return &ConditionsEntry{}
	}

	ce := &ConditionsEntry{}
	if err := json.Unmarshal(j, ce); err != nil {
		l.log.Errorf(err.Error())
		return &ConditionsEntry{}
	}
	return ce
}

func (l *DataLogger) conditionsFilePath(t time.Time) string {
	return filepath.Join(l.root, conditionsSubdir, fmt.Sprint(t.Year()), fmt.Sprint(int(t.Month())), fmt.Sprint(t.Day())+logFileExtension)
}

type RuntimesEntry struct {
	Date     time.Time
	Runtimes []float64
}

func (l *DataLogger) WriteRuntimes(t time.Time, runtimes []float64) error {
	fp := l.runtimesFilePath(t)
	if err := createDirIfMissing(fp); err != nil {
		return err
	}
	j, err := json.Marshal(RuntimesEntry{dateOnly(t), runtimes})
	if err != nil {
		return err
	}
	if err := ioutil.WriteFile(fp, j, 0644); err != nil {
		return err
	}
	l.log.Infof("WriteRuntimes for %s : %s\n", dateOnly(t), string(j))
	return nil
}

func (l *DataLogger) ReadRuntimes(from, to time.Time) ([]*RuntimesEntry, error) {
	now := dateOnly(from)
	after := dateOnly(to.AddDate(0, 0, 1))
	var out []*RuntimesEntry
	for now.Before(after) {
		r, err := l.readRuntimesOneDay(now)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
		now = now.AddDate(0, 0, 1)
	}
	return out, nil
}

func (l *DataLogger) readRuntimesOneDay(t time.Time) (*RuntimesEntry, error) {
	j, err := ioutil.ReadFile(l.runtimesFilePath(t))
	if err != nil {
		return nil, err
	}

	var rts *RuntimesEntry
	if err := json.Unmarshal(j, &rts); err != nil {
		return nil, err
	}
	return rts, nil
}

func (l *DataLogger) runtimesFilePath(t time.Time) string {
	return filepath.Join(l.root, runtimesSubdir, fmt.Sprint(t.Year()), fmt.Sprint(int(t.Month())), fmt.Sprint(t.Day())+logFileExtension)
}

func createDirIfMissing(filePath string) error {
	// DEBUG REMOVE
	return nil
	dirPath, _ := filepath.Split(filePath)
	fmt.Printf("making dir %s\n", dirPath)
	return os.MkdirAll(dirPath, 0777)
}

func dateOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
