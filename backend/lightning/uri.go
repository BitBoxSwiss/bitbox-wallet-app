// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
)

type uriRequest struct {
	Revision uint64 `json:"revision"`
	// Nil means no pending link; an empty input must still be shown as invalid.
	Input *string `json:"input"`
}

// HandleURI retains the input from a lightning: or lightning:// URI until the frontend can open it.
// The backend validates the scheme; the SDK validates the payment input once Lightning is ready.
func (lightning *Lightning) HandleURI(uri string) {
	_, input, _ := strings.Cut(uri, ":")
	input = strings.TrimPrefix(input, "//")
	lightning.uriLock.Lock()
	lightning.uri.Revision++
	lightning.uri.Input = &input
	request := lightning.uri
	lightning.uriLock.Unlock()
	lightning.notifyURI(request)
}

// URI returns the pending payment link, including links received before the frontend started.
func (lightning *Lightning) URI() uriRequest {
	lightning.uriLock.Lock()
	defer lightning.uriLock.Unlock()
	return lightning.uri
}

// ClearURI acknowledges a link without discarding one that arrived while it was being handled.
func (lightning *Lightning) ClearURI(revision uint64) {
	lightning.uriLock.Lock()
	if lightning.uri.Revision != revision || lightning.uri.Input == nil {
		lightning.uriLock.Unlock()
		return
	}
	lightning.uri.Revision++
	lightning.uri.Input = nil
	request := lightning.uri
	lightning.uriLock.Unlock()
	lightning.notifyURI(request)
}

func (lightning *Lightning) notifyURI(request uriRequest) {
	lightning.Notify(observable.Event{
		Subject: "lightning/uri",
		Action:  action.Replace,
		Object:  request,
	})
}
