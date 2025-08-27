// Copyright 2022-2025 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package failover

import (
	"errors"
	"math/rand"
	"sync"
	"time"
)

// ErrClosed is returned by `Call` and `Subscribe` if the failover client is closed. It is also
// passed to `OnDisconnect()` if the connection was closed because the failover client was closed.
var ErrClosed error = errors.New("closed")

// ErrNoServers is used when no servers are configured, so no connection can be established. It is
// passed to `OnRetry()`.
var ErrNoServers error = errors.New("No servers configured.")

// FailoverError triggers a failover to another server. Other errors are passed through.
type FailoverError struct {
	err error
}

func (f *FailoverError) Error() string { return f.err.Error() }

// NewFailoverError wraps an error in a FailoverError.
func NewFailoverError(err error) *FailoverError {
	return &FailoverError{err: err}
}

func isFailoverError(err error) bool {
	failoverError := new(FailoverError)
	return errors.As(err, &failoverError)
}

const defaultRetryTimeout = 15 * time.Second

// Client describes which methods a generic client must implement.
type Client interface {
	// f is installed as a callaback that can be called in case of asynchronous errors. Calling it
	// triggers a failover to another server.
	SetOnError(f func(error))
	// Close should close the client, stop all pending requests, wind down all goroutines, stop
	// sending notifications for subscriptions, etc.
	Close()
}

// Server are the server details.
type Server[C Client] struct {
	// Name is a name of the server, useful for logging etc.
	Name string
	// Connect connects to the server.
	Connect func() (C, error)
}

func (s *Server[C]) String() string { return s.Name }

// Options for the failover client.
type Options[C Client] struct {
	Servers []*Server[C]
	// StartIndex returns an integer in the range `[0, len(Servers))` and defines the first server
	// to connect to. If `nil`, a random value is used for load balancing. This function will be
	// called only once.
	StartIndex func() int
	// RetryTimeout is the time we wait to retry any server after all servers failed had a
	// failure. If not specified, defaults to 15s.
	RetryTimeout time.Duration
	// OnConnect is called when a successful connection is established (when `server.Connect()` ran
	// without an error).
	OnConnect func(server *Server[C])
	// OnDisconnect is called when a running server connection is closed. The passed error is hte
	// error that caused the disconnect.
	OnDisconnect func(server *Server[C], err error)
	// OnRetry is called if all servers are not reachable or responded with an error. The passed
	// error is the last error that triggered a failover.
	OnRetry func(error)
}

func (o *Options[C]) retryTimeout() time.Duration {
	if o.RetryTimeout != 0 {
		return o.RetryTimeout
	}
	return defaultRetryTimeout
}

// Failover is a generic client that is backed by multiple servers. If a server fails, there is an
// automatic failover to another server. If all servers fail, there is a retry timeout and all
// servers are tried again. Subscriptions are automatically re-subscribed on new servers.
type Failover[C Client] struct {
	opts *Options[C]
	// This value is set from `opts.StartIndex()` and never changes.
	startServerIndex int
	// mutex covers `lastErr`, `clientCounter`, `currentServerIndex`, `currentClient`, `enableRetry`
	// and `subscriptions`.
	mutex sync.RWMutex
	// lastErr records the last seen error that triggered a failover. Can be nil.
	lastErr error
	// clientCounter counts up whenever we connect with a new client. It serves as a client ID.
	clientCounter int
	// currentServerIndex is the index of the server in `opts.Servers` that we are attempting to
	// connect to or are connected to.
	currentServerIndex int
	// currentClient is the currently active client connection.
	currentClient *C
	// enableRetry enables retrying from the beginning if all servers failed. This is a bookkeeping
	// var and is set to true right after the first connection attempt is made, so that we don't
	// start with a retry timeout.
	enableRetry   bool
	subscriptions []func(client C, currentClientCounter int)

	manualReconnect chan struct{}

	closed   bool
	closedMu sync.RWMutex

	quitCh chan struct{}
}

// New creates a new failover client.
func New[C Client](opts *Options[C]) *Failover[C] {
	var startServerIndex int
	if len(opts.Servers) == 0 {
		// startServerIndex does not apply. We don't return an error here but treat this as a
		// connection error with retries, as we might want to add functionality to
		// add/remove/replace servers dynamically.
	} else if opts.StartIndex != nil {
		startServerIndex = opts.StartIndex()
		if startServerIndex < 0 || startServerIndex >= len(opts.Servers) {
			startServerIndex = 0
		}
	} else {
		rand.Seed(time.Now().UnixNano())
		startServerIndex = rand.Intn(len(opts.Servers))
	}
	return &Failover[C]{
		opts:               opts,
		startServerIndex:   startServerIndex,
		currentServerIndex: startServerIndex,
		manualReconnect:    make(chan struct{}),
		quitCh:             make(chan struct{}),
	}
}

// `mutex` write lock must be held when calling this function.
func (f *Failover[C]) establishConnection() error {
	for !f.isClosed() {
		currentServerIndex := f.currentServerIndex
		if f.enableRetry && currentServerIndex == f.startServerIndex {
			retryTimeout := f.opts.retryTimeout()
			if f.opts.OnRetry != nil {
				go f.opts.OnRetry(f.lastErr)
			}

			// Drain the manualReconnect channel to avoid stale reconnect signals
			select {
			case <-f.manualReconnect:
			default:
			}
			// Wait for retry timeout or manual reconnect or close.
			select {
			case <-f.quitCh:
				return ErrClosed
			default:
				select {
				case <-f.quitCh:
					return ErrClosed
				case <-time.After(retryTimeout):
				case <-f.manualReconnect:
				}
			}

		}
		f.enableRetry = true

		if len(f.opts.Servers) == 0 {
			f.lastErr = ErrNoServers
			continue
		}
		server := f.opts.Servers[currentServerIndex]
		currentClient, err := server.Connect()
		if err != nil {
			f.currentServerIndex = (f.currentServerIndex + 1) % len(f.opts.Servers)
			f.clientCounter++
			f.lastErr = err
			continue
		}
		f.currentClient = &currentClient
		currentClientCounter := f.clientCounter

		// If the client produces any error outside of a direct method call (i.e. failing to read
		// the socket in the readloop, invalid JSON returned by server, etc.), we kill this client
		// and go to the next server.
		currentClient.SetOnError(func(err error) {
			f.triggerFailover(currentClientCounter, err)
		})

		if f.opts.OnConnect != nil {
			go f.opts.OnConnect(server)
		}
		for _, subscriptionMethod := range f.subscriptions {
			go subscriptionMethod(currentClient, currentClientCounter)
		}
		return nil
	}
	return ErrClosed
}

func (f *Failover[C]) client() (C, int, error) {
	{ // Shortcut if client is already set.
		f.mutex.RLock()
		currentClient := f.currentClient
		clientCounter := f.clientCounter
		f.mutex.RUnlock()
		if currentClient != nil {
			if f.isClosed() {
				var empty C
				return empty, 0, ErrClosed
			}
			return *currentClient, clientCounter, nil
		}
	}

	f.mutex.Lock()
	defer f.mutex.Unlock()
	if f.currentClient != nil {
		if f.isClosed() {
			var empty C
			return empty, 0, ErrClosed
		}
		return *f.currentClient, f.clientCounter, nil
	}

	err := f.establishConnection()
	if err != nil {
		var empty C
		return empty, 0, err
	}
	return *f.currentClient, f.clientCounter, nil
}

// closeCurrentClient closes the current client if it exists and calls the `OnDisconnect`
// callback. `mutex` write lock must be held. `err` is the error that caused the disconnect.
func (f *Failover[C]) closeCurrentClient(err error) {
	if f.currentClient != nil {
		(*f.currentClient).Close()
		if f.opts.OnDisconnect != nil {
			go f.opts.OnDisconnect(f.opts.Servers[f.currentServerIndex], err)
		}
		f.currentClient = nil
	}
}

// triggerFailover closes the existing connection and connects to the next server.
//
// `currentClientCounter` should be `c.clientCounter` of the client that is failing and triggering
// the failover. `err` must be not nil and is the reason the failover was triggered.
func (f *Failover[C]) triggerFailover(currentClientCounter int, err error) {
	if f.isClosed() {
		return
	}
	f.mutex.Lock()
	defer f.mutex.Unlock()
	// We only move to the next server if not done already, e.g. by another call that failed and
	// triggered `triggerFailover()` already.
	if currentClientCounter != f.clientCounter {
		return
	}
	f.closeCurrentClient(err)
	f.currentServerIndex = (f.currentServerIndex + 1) % len(f.opts.Servers)
	f.clientCounter++
	f.lastErr = err
	_ = f.establishConnection()
}

// Call calls the passed function repeatedly with different servers until one of them returns the
// result without an error of type FailOverError. If all servers failed, there is a retry timeout
// and they are tried again.
//
// If the failover client was closed before making the request, `ErrClosed` is returned. The server
// error is passed as-is if the failover client was closed while processing the request, or if the
// server returns an error that is not a FailOverError.
func Call[C Client, R any](c *Failover[C], f func(client C) (R, error)) (R, error) {
	for {
		client, clientCounter, err := c.client()
		if err != nil {
			var empty R
			return empty, err
		}
		result, err := f(client)
		if err != nil {
			if isFailoverError(err) {
				c.triggerFailover(clientCounter, err)
				continue
			}
			return result, err
		}
		return result, nil
	}
}

// CallAlwaysFailover is like Call, but every error is treated as a FailoverError, trigger a
// failover. This function blocks forever until one of the servers delivers a non-error result, or
// the failover client was closed.
func CallAlwaysFailover[C Client, R any](c *Failover[C], f func(client C) (R, error)) (R, error) {
	return Call(c, func(client C) (R, error) {
		result, err := f(client)
		if err != nil {
			return result, NewFailoverError(err)
		}
		return result, nil
	})
}

// Subscribe calls the passed `subscriptionCall` function repeatedly with different servers until
// one of them returns a result without an error of type FailOverError. If all servers failed, there
// is a retry timeout and they are tried again.
//
// The passed function is a subscription registration function, It subscribes to notifications, with
// the notifications going to the `result` callback. If the result callback is called with an error
// of type FailOverError, failover happens automatically.
//
// This subscription call is re-executed on each server that is connected.
//
// If the failover client was closed before making the subscription request, `ErrClosed` is
// returned. The server error is passed as-is to the result callback if the failover client was
// closed, or if the server returns an error that is not a FailOverError.
func Subscribe[C Client, R any](
	c *Failover[C],
	subscriptionCall func(client C, result func(R, error)),
	result func(R, error)) {
	subscribe := func(client C, clientCounter int) {
		subscriptionCall(client, func(r R, err error) {
			if err != nil {
				if isFailoverError(err) {
					c.triggerFailover(clientCounter, err)
					return
				}
			}
			result(r, err)
		})
	}

	client, clientCounter, err := c.client()
	if err != nil {
		var empty R
		result(empty, err)
		return
	}
	c.mutex.Lock()
	c.subscriptions = append(c.subscriptions, subscribe)
	c.mutex.Unlock()

	subscribe(client, clientCounter)
}

// SubscribeAlwaysFailover is like Subscribe, but every error is treated as a FailOverError. The
// result callback is only called when one of the servers delivers a non-error result, or
// the failover client was closed.
func SubscribeAlwaysFailover[C Client, R any](
	c *Failover[C],
	subscriptionCall func(client C, result func(R, error)),
	result func(R, error)) {
	Subscribe(
		c,
		func(client C, result func(R, error)) {
			subscriptionCall(client, func(r R, err error) {
				if err != nil {
					result(r, NewFailoverError(err))
					return
				}
				result(r, nil)
			})
		},
		result,
	)
}

func (f *Failover[C]) isClosed() bool {
	f.closedMu.RLock()
	defer f.closedMu.RUnlock()
	return f.closed
}

// ManualReconnect triggers a manual reconnect, non-blocking.
// This re-tries connecting immediately without waiting for the retry timeout.
// We we are not currently disconnected, this is a no-op.
func (f *Failover[C]) ManualReconnect() {
	select {
	case f.manualReconnect <- struct{}{}:
	default:
	}
}

// Close closes the failover client and closes the current client, resulting in `ErrClosed` in all
// future `Call` and `Subscribe` calls. It also calls `Close()` on the currently active client if
// one exists.
func (f *Failover[C]) Close() {
	alreadyClosed := func() bool {
		f.closedMu.Lock()
		defer f.closedMu.Unlock()
		if f.closed {
			return true
		}
		f.closed = true
		return false
	}()
	if alreadyClosed {
		return
	}
	close(f.quitCh)
	f.mutex.Lock()
	defer f.mutex.Unlock()
	f.closeCurrentClient(ErrClosed)
}
