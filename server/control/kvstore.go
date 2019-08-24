package control

import (
	"fmt"
	"time"

	"github.com/dgraph-io/badger"
	log "github.com/golang/glog"
)

const (
	kvNumAttempts   int           = 10
	kvRetryInterval time.Duration = 1 * time.Minute
	kvGCInterval    time.Duration = 24 * time.Hour
	kvDiscardRatio                = 0.5
)

// KVStore is a key value store.
type KVStore interface {
	// Get returns the value of the given key. It returns false if the key
	// is not found.
	Get(key string) (string, bool, error)
	// Set sets the given key with the given value.
	Set(key, value string) error
	// Close closes the KV store.
	Close() error
}

// TestKVStore is an in memory KV store for testing.
type TestKVStore struct {
	kvmap map[string]string
}

// NewTestKVStore returns a ptr to an intialized TestKVStore.
func NewTestKVStore() *TestKVStore {
	return &TestKVStore{
		kvmap: make(map[string]string),
	}
}

// Get implements KVStore#Get.
func (kv *TestKVStore) Get(key string) (string, bool, error) {
	v, ok := kv.kvmap[key]
	return v, ok, nil
}

// Set implements KVStore#Set.
func (kv *TestKVStore) Set(key, value string) error {
	kv.kvmap[key] = value
	return nil
}

// Close implements KVStore#Close.
func (kv *TestKVStore) Close() error { return nil }

// BadgerKVStore is a badger KV store.
type BadgerKVStore struct {
	db     *badger.DB
	lastGC time.Time
}

// NewBadgerKVStore creates a new BadgerKVStore and returns a ptr to it.
func NewBadgerKVStore(dbPath string) (*BadgerKVStore, error) {
	opts := badger.DefaultOptions
	opts.Dir = dbPath
	opts.ValueDir = dbPath
	opts.SyncWrites = true
	var err error
	ret := &BadgerKVStore{}
	ret.db, err = badger.Open(opts)
	if err != nil {
		return nil, err
	}
	ret.runGC()
	return ret, nil
}

// runGC runs garbage collection if necessary.
func (kv *BadgerKVStore) runGC() {
	if time.Since(kv.lastGC) < kvGCInterval {
		//log.Infof("skipping badger GC")
		return
	}
	log.Infof("running badger GC")
	kv.db.PurgeOlderVersions()
	kv.db.RunValueLogGC(kvDiscardRatio)
	kv.lastGC = time.Now()
}

// Get implements KVStore#Get.
func (kv *BadgerKVStore) Get(key string) (string, bool, error) {
	getFunc := RetryFunction(func() (interface{}, error) {
		var val interface{}
		err := kv.db.View(func(txn *badger.Txn) error {
			item, err := txn.Get([]byte(key))
			if err != nil {
				return err
			}
			val, err = item.Value()
			if err != nil {
				return err
			}
			return nil
		})
		return val, err
	})
	// don't retry if key is not found the first time.
	val, err := getFunc()
	switch err {
	case nil:
		valStr, err := toStringOrError(val)
		return valStr, true, err
	case badger.ErrKeyNotFound:
		return "", false, nil
	}

	if val, err = RetryThenFail(getFunc, kvNumAttempts, kvRetryInterval); err != nil {
		return "", true, err
	}

	valStr, err := toStringOrError(val)
	return valStr, true, err
}

func toStringOrError(val interface{}) (string, error) {
	valB, ok := val.([]byte)
	if !ok {
		return "", fmt.Errorf("kv Get got type %T, want string", val)
	}
	return string(valB), nil
}

// Set implements KVStore#Set.
func (kv *BadgerKVStore) Set(key, value string) error {
	setFunc := RetryFunction(func() (interface{}, error) {
		return nil, kv.db.Update(func(txn *badger.Txn) error {
			return txn.Set([]byte(key), []byte(value))
		})
	})

	_, err := RetryThenFail(setFunc, kvNumAttempts, kvRetryInterval)
	kv.runGC()
	return err
}

// Close implements KVStore#Close.
func (kv *BadgerKVStore) Close() error {
	return kv.db.Close()
}

// RetryFunction is a function that is retried if error is not nil.
type RetryFunction func() (interface{}, error)

// RetryThenFail retries the given function fn for the given number of attempts,
// with a pause of retryMins in between attempts. It keeps retrying until
// either fn returns nil or attempts is exceeded.
func RetryThenFail(fn RetryFunction, attempts int, retryInterval time.Duration) (interface{}, error) {
	var err error
	var ret interface{}
	for a := 0; a < attempts; a++ {
		ret, err = fn()
		if err == nil {
			return ret, nil
		}
		log.Errorf("Call to %v failed, retrying: %s", fn, err)
		time.Sleep(retryInterval)
	}

	return nil, fmt.Errorf("Call to %v failed after %d attempts: %s", fn, attempts, err)
}
