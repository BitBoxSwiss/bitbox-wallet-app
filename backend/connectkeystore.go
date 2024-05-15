// Copyright 2023 Shift Crypto AG
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

package backend

import (
	"bytes"
	"context"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
)

const (
	// ErrWrongKeystore is returned if the connected keystore is not the expected one.
	ErrWrongKeystore errp.ErrorCode = "wrongKeystore"

	errTimeout  errp.ErrorCode = "timeout"
	errReplaced errp.ErrorCode = "connectReplaced"
)

// connectKeystore is a helper struct to enable connecting to a keystore with a specific root
// fingerprint.
type connectKeystore struct {
	locker.Locker
	// connectKeystoreCallback, if not nil, is called when a keystore is registered.
	connectKeystoreCallback func(keystore.Keystore)
	// retryCallback, if not nil, is called when a keystore is deregistered or when the cancel() is called.
	// It allows to make a new connect attempt after a wrong keystore was connected, unless the request has
	// been aborted.
	retryCallback func(retry bool)
	cancelFunc    context.CancelCauseFunc
}

func compareRootFingerprint(ks keystore.Keystore, rootFingerprint []byte) error {
	keystoreRootFingerprint, err := ks.RootFingerprint()
	if err != nil {
		return err
	}
	if !bytes.Equal(rootFingerprint, keystoreRootFingerprint) {
		return ErrWrongKeystore
	}
	return nil
}

// connect blocks until the keystore with the given rootFingerprint is connected and then returns
// that keystore. If it is already connected, the it is returned immediately. If the next keystore
// being connected is not the right fingerprint, `errWrongKeystore` is returned.
//
// Only one such call is supported at once. If another call is aleady ongoing, `errReplaced` is returned.
// If `c.cancel(err)` is called, this function returns `err`.
// If the keystore is not connected within the specified time, `context.DeadlineExceeded` is returned.
func (c *connectKeystore) connect(
	currentKeystore keystore.Keystore,
	rootFingerprint []byte,
	timeout time.Duration,
) (keystore.Keystore, error) {
	type result struct {
		ks  keystore.Keystore
		err error
	}

	resultCh := make(chan result)
	alreadyRunning := func() bool {
		defer c.RLock()()
		return c.connectKeystoreCallback != nil
	}()
	if alreadyRunning {
		// Cancel previous prompt - new prompt takes precedence.
		c.cancel(errReplaced)
	}

	if currentKeystore != nil {
		if err := compareRootFingerprint(currentKeystore, rootFingerprint); err != nil {
			return nil, err
		}
		return currentKeystore, nil
	}

	ctx, cancel := context.WithCancelCause(context.Background())
	// clean up the cancel resource in case we resolve the context by timeout.
	defer cancel(nil)
	ctx, cancelTimeout := context.WithTimeout(ctx, timeout)
	// clean up the timeout resource in case we resolve the context by manual cancellation.
	// this is technically not needed as the parent context cancel above also cleans up the derived
	// context, but `go vet` complains about it as it is best practice to be explicit.
	defer cancelTimeout()

	go func() {
		defer c.Lock()()
		c.cancelFunc = cancel
		c.connectKeystoreCallback = func(ks keystore.Keystore) {
			if err := compareRootFingerprint(ks, rootFingerprint); err != nil {
				resultCh <- result{nil, err}
				return
			}
			resultCh <- result{ks, nil}
		}
	}()

	select {
	case r := <-resultCh:
		return r.ks, r.err
	case <-ctx.Done():
		if context.Cause(ctx) == context.DeadlineExceeded {
			return nil, errTimeout
		}
		return nil, context.Cause(ctx)
	}
}

// onConnect should be called when a keystore is registered. It will resolve a pending call to
// `connect()`.
func (c *connectKeystore) onConnect(keystore keystore.Keystore) {
	defer c.Lock()()
	if c.connectKeystoreCallback != nil {
		c.connectKeystoreCallback(keystore)
		c.connectKeystoreCallback = nil
		c.cancelFunc = nil
	}
}

func (c *connectKeystore) onDisconnect() {
	defer c.Lock()()
	if c.retryCallback != nil {
		c.retryCallback(true)
		c.retryCallback = nil
	}
}

// cancel fails a pending call to `connect()`, making it return `cause` as the error.
func (c *connectKeystore) cancel(cause error) {
	defer c.Lock()()
	if c.cancelFunc != nil {
		c.cancelFunc(cause)
		c.cancelFunc = nil
		c.connectKeystoreCallback = nil
	}
	if c.retryCallback != nil {
		c.retryCallback(false)
		c.retryCallback = nil
	}
}

func (c *connectKeystore) SetRetryConnect(f func(retry bool)) {
	defer c.Lock()()
	c.retryCallback = f
}
