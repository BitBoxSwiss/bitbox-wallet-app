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
	"sync"
	"testing"
	"time"

	keystoremock "github.com/digitalbitbox/bitbox-wallet-app/backend/keystore/mocks"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"

	"github.com/stretchr/testify/require"
)

func TestConnectKeystore(t *testing.T) {
	ck := connectKeystore{}
	fingerprint := []byte{1, 2, 3, 4}
	fingerprint2 := []byte{5, 6, 7, 8}

	expectedKeystore := &keystoremock.KeystoreMock{
		RootFingerprintFunc: func() ([]byte, error) {
			return fingerprint, nil
		},
	}

	t.Run("timeout", func(t *testing.T) {
		_, err := ck.connect(nil, fingerprint, time.Millisecond)
		require.Equal(t, errTimeout, err)
	})

	t.Run("already connected", func(t *testing.T) {
		ks, err := ck.connect(expectedKeystore, fingerprint, time.Millisecond)
		require.NoError(t, err)
		require.Equal(t, expectedKeystore, ks)
	})

	t.Run("canceled", func(t *testing.T) {
		wg := sync.WaitGroup{}
		wg.Add(1)
		go func() {
			defer wg.Done()
			time.Sleep(50 * time.Millisecond)
			ck.cancel(errp.ErrUserAbort)
		}()
		_, err := ck.connect(nil, fingerprint, time.Second)
		require.Equal(t, errp.ErrUserAbort, err)
		wg.Wait()
	})

	t.Run("success", func(t *testing.T) {
		wg := sync.WaitGroup{}
		wg.Add(1)
		go func() {
			defer wg.Done()
			time.Sleep(50 * time.Millisecond)
			ck.onConnect(expectedKeystore)
		}()
		ks, err := ck.connect(nil, fingerprint, time.Second)
		require.NoError(t, err)
		require.Equal(t, expectedKeystore, ks)
		wg.Wait()
	})

	t.Run("already connecting", func(t *testing.T) {
		wg := sync.WaitGroup{}
		wg.Add(1)
		go func() {
			defer wg.Done()
			time.Sleep(50 * time.Millisecond)
			ck.onConnect(expectedKeystore)
		}()
		wg.Add(1)
		go func() {
			defer wg.Done()
			// Previous prompt is canceled by new prompt.
			_, err := ck.connect(nil, fingerprint2, time.Minute)
			require.Equal(t, errReplaced, err)
		}()

		time.Sleep(25 * time.Millisecond)
		_, err := ck.connect(nil, fingerprint, time.Second)
		require.NoError(t, err)
		wg.Wait()
	})

	t.Run("wrong keystore", func(t *testing.T) {
		wg := sync.WaitGroup{}
		wg.Add(1)
		go func() {
			defer wg.Done()
			time.Sleep(50 * time.Millisecond)
			ck.onConnect(expectedKeystore)
		}()
		_, err := ck.connect(nil, fingerprint2, time.Second)
		require.Equal(t, ErrWrongKeystore, err)
		wg.Wait()
	})
}
