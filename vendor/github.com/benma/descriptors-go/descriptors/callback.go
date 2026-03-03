package descriptors

import (
	"context"
	"log"
	"sync"
	"sync/atomic"

	"github.com/tetratelabs/wazero/api"
)

var (
	callbackMutex   sync.Mutex
	callbackCounter uint32
	callbacks       = make(map[uint32]func(string) string)
)

func invokeCallback(_ context.Context, m api.Module, callback_id uint32, argPtr, argSize uint32) uint64 {
	arg, ok := m.Memory().Read(argPtr, argSize)
	if !ok {
		log.Panicf("Memory.Read(%d, %d) out of range", argPtr, argSize)
	}
	callbackMutex.Lock()
	f := callbacks[callback_id]
	callbackMutex.Unlock()

	result := f(string(arg))
	// freed in Rust
	ptr, _ := rustString(result)
	return ptr
}

func registerCallback(f func(string) string) (uint32, func()) {
	callbackMutex.Lock()
	defer callbackMutex.Unlock()

	id := atomic.AddUint32(&callbackCounter, 1)
	callbacks[id] = f
	unregisterCallback := func() {
		callbackMutex.Lock()
		delete(callbacks, id)
		callbackMutex.Unlock()
	}
	return id, unregisterCallback
}
