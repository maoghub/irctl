package control

import (
	"os"
	"testing"
)

const (
	testKVStorePath = "/tmp/badgerTest"

	testKey = "answer"
	testVal = "forty-two"
)

func TestBadgerKVStore(t *testing.T) {
	if err := os.RemoveAll(testKVStorePath); err != nil {
		panic(err)
	}
	log := &TestLogger{}
	kv, err := NewBadgerKVStore(testKVStorePath, log)
	if err != nil {
		t.Fatal(err)
	}

	val, found, err := kv.Get(testKey)
	if err != nil {
		t.Fatal(err)
	}
	if found {
		t.Fatal("value found before it's set")
	}

	err = kv.Set(testKey, testVal)
	if err != nil {
		t.Fatal(err)
	}

	val, found, err = kv.Get(testKey)
	if err != nil {
		t.Fatal(err)
	}
	if !found {
		t.Fatal("value not found")
	}
	if val != testVal {
		t.Fatalf("got: %s, want %s", val, testVal)
	}
	
	// Close, then reopen KV store.
	if err := kv.Close(); err != nil {
		t.Fatal(err)
	}
	kv, err = NewBadgerKVStore(testKVStorePath, log)
	if err != nil {
		t.Fatal(err)
	}
	defer kv.Close()
	val, found, err = kv.Get(testKey)
	if err != nil {
		t.Fatal(err)
	}
	if !found {
		t.Fatal("value not found after reopening")
	}
}
