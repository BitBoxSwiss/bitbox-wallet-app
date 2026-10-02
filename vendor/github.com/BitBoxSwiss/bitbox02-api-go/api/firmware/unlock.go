// SPDX-License-Identifier: Apache-2.0

package firmware

import (
	"time"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
)

func (device *Device) supportsPairedUnlock() bool {
	return device.version.AtLeast(semver.NewSemVer(9, 28, 0))
}

// unlock owns all protocol I/O until the device has finished unlocking. The UI only signals
// the current phase's channel, so a delayed click cannot affect a later phase or unlock.
func (device *Device) unlock() error {
	return device.atomicQueries(func() (err error) {
		config := device.options.passphrase
		var hostEntry chan struct{}
		withdraw := func() {
			if hostEntry != nil {
				hostEntry = nil
				config.OnHostPassphraseAvailable(nil)
			}
		}
		defer func() {
			if err != nil && device.ctx.Err() == nil {
				// A known local failure must release the device's workflow. Try RESET once;
				// ChannelHashVerify closes the connection and reconnect will reset it again.
				_, _ = device.communication.Query([]byte(hwwReqReset))
			}
		}()
		defer withdraw()

		autoRequest := config.EnterMnemonicPassphrase != nil && config.OnHostPassphraseAvailable == nil
		consentRequested := false
		request := &messages.Request{Request: &messages.Request_Unlock{Unlock: &messages.UnlockRequest{}}}
		for {
			if err := device.ctx.Err(); err != nil {
				return err
			}
			response, err := device.nonAtomicQuery(request)
			if err != nil {
				return err
			}
			reply, ok := response.Response.(*messages.Response_Unlock)
			if !ok || reply.Unlock == nil {
				return errp.New("expected Unlock response")
			}
			switch reply.Unlock.State {
			case messages.UnlockResponse_DONE:
				return nil
			case messages.UnlockResponse_PASSPHRASE_PENDING:
				consentRequested = false
				if autoRequest {
					// Rejection or cancellation falls back to device entry without prompting again.
					autoRequest = false
					consentRequested = true
				} else {
					if config.OnHostPassphraseAvailable != nil && config.EnterMnemonicPassphrase != nil && hostEntry == nil {
						hostEntry = make(chan struct{}, 1)
						current := hostEntry
						config.OnHostPassphraseAvailable(func() {
							select {
							case current <- struct{}{}:
							default:
							}
						})
					}
					select {
					case <-device.ctx.Done():
						return device.ctx.Err()
					case <-hostEntry:
						consentRequested = true
						withdraw()
					case <-time.After(100 * time.Millisecond):
					}
				}
				request = &messages.Request{Request: &messages.Request_UnlockContinue{
					UnlockContinue: &messages.UnlockContinueRequest{RequestHostEntry: consentRequested},
				}}
			case messages.UnlockResponse_PASSPHRASE_ENTERED:
				consentRequested = false
				withdraw()
				device.fireEvent(EventPassphraseEntered)
				request = &messages.Request{Request: &messages.Request_UnlockContinue{
					UnlockContinue: &messages.UnlockContinueRequest{},
				}}
			case messages.UnlockResponse_HOST_ENTRY_READY:
				if !consentRequested || config.EnterMnemonicPassphrase == nil {
					return errp.New("unexpected host passphrase request")
				}
				consentRequested = false
				passphrase, err := config.EnterMnemonicPassphrase(device.ctx)
				if err != nil {
					return err
				}
				request = &messages.Request{Request: &messages.Request_UnlockHostInfo{
					UnlockHostInfo: &messages.UnlockHostInfoRequest{Passphrase: passphrase},
				}}
			default:
				return errp.New("unexpected unlock phase")
			}
		}
	})
}
