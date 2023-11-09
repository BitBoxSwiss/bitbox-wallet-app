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
	"errors"
	"time"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/keystore"
	"github.com/digitalbitbox/bitbox-wallet-app/util/locker"
)

// ErrWrongKeystore is returned when the user prompted to connect a keystore for a specific
// fingerprint but connects a keystore that does not match that fingerprint.
var ErrWrongKeystore = errors.New("Wrong device/keystore connected.")

var errInProgress = errors.New("Previous request for connecting a keystore is still in progress.")

// connectKeystore is a helper struct to enable connecting to a keystore with a specific root
// fingerprint.
type connectKeystore struct {
	locker.Locker
	// connectKeystoreCallback, if not nil, is called when a keystore is registered.
	connectKeystoreCallback func(keystore.Keystore)

	cancelFunc context.CancelFunc
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

// connect calls the callback as soon as the keystore with the given rootFingerprint is
// connected. If it is already connected, the callback is called immediately. If the next keystore
// begin connected is not the right fingerprint, the callback is called with an error.
//
// Only one such call is supported at once. If another call is aleady ongoing, an error is returned.
// If `c.cancel()` is called, this function returns the `context.Canceled` error.
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

	if currentKeystore != nil {
		if err := compareRootFingerprint(currentKeystore, rootFingerprint); err != nil {
			return nil, err
		}
		return currentKeystore, nil
	}

	alreadyRunning := func() bool {
		defer c.RLock()()
		return c.connectKeystoreCallback != nil
	}()
	if alreadyRunning {
		return nil, errInProgress
	}

	defer func() {
		defer c.Lock()()
		c.connectKeystoreCallback = nil
		c.cancelFunc = nil
	}()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)

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
		return nil, ctx.Err()
	}
}

func (c *connectKeystore) onConnect(keystore keystore.Keystore) {
	defer c.Lock()()
	if c.connectKeystoreCallback != nil {
		c.connectKeystoreCallback(keystore)
		c.connectKeystoreCallback = nil
	}
}

func (c *connectKeystore) cancel() {
	defer c.Lock()()
	if c.cancelFunc != nil {
		c.cancelFunc()
		c.cancelFunc = nil
	}
}
