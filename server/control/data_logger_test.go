package control

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"
	"time"
)

const (
	testPath = "../temp"
)

func TestConditions(t *testing.T) {
	want := []*ConditionsEntry{
		{
			Date:   time.Date(1, 2, 3, 0, 0, 0, 0, time.UTC),
			Icon:   "test",
			Temp:   42.42,
			Precip: 4.2,
		},
		{
			Date:   time.Date(1, 2, 4, 0, 0, 0, 0, time.UTC),
			Icon:   "test2",
			Temp:   43.43,
			Precip: 4.3,
		},
	}

	log := &TestLogger{}
	l := NewDataLogger(log, testPath)

	for _, c := range want {
		if err := l.WriteConditions(c.Date, c.Icon, c.Temp, c.Precip); err != nil {
			t.Fatal(err)
		}
	}

	got, errs := l.ReadConditions(want[0].Date, want[len(want)-1].Date)
	if errs != nil {
		t.Fatal(errs)
	}

	if !reflect.DeepEqual(got, want) {
		t.Errorf("got: %v, want: %v", got, want)
	}

	j, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}

	fmt.Println(string(j))
}

func TestRuntimes(t *testing.T) {
	want := []*RuntimesEntry{
		{time.Date(1, 2, 3, 0, 0, 0, 0, time.UTC), []float64{1.0, 2.0, 3.0, 4.0}},
		{time.Date(1, 2, 4, 0, 0, 0, 0, time.UTC), []float64{1.1, 2.1, 3.1, 4.1}},
	}

	log := &TestLogger{}
	l := NewDataLogger(log, testPath)

	for _, r := range want {
		if err := l.WriteRuntimes(r.Date, r.Runtimes); err != nil {
			t.Fatal(err)
		}
	}

	got, errs := l.ReadRuntimes(want[0].Date, want[len(want)-1].Date)
	if errs != nil {
		t.Fatal(errs)
	}

	if !reflect.DeepEqual(got, want) {
		t.Errorf("got: %v, want: %v", got, want)
	}

	j, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}

	fmt.Println(string(j))
}
