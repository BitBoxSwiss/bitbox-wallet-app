package locker

import "sync"

type Locker struct {
	mutex sync.RWMutex
}

func (locker *Locker) Lock() func() {
	locker.mutex.Lock()
	return locker.mutex.Unlock
}

func (locker *Locker) RLock() func() {
	locker.mutex.RLock()
	return locker.mutex.RUnlock
}
