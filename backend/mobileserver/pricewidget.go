// SPDX-License-Identifier: Apache-2.0

package mobileserver

import (
	"context"
	"encoding/json"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/pricewidget"
)

var widgetService = pricewidget.New()

// PriceWidgetRequest owns one cancelable widget fetch.
type PriceWidgetRequest struct {
	// Gomobile cannot pass context.Context across the Java bridge; the request owns its lifetime.
	//nolint:containedctx
	ctx    context.Context
	cancel context.CancelFunc
}

// NewPriceWidgetRequest creates a request before a worker starts fetching.
func NewPriceWidgetRequest() *PriceWidgetRequest {
	ctx, cancel := context.WithCancel(context.Background())
	return &PriceWidgetRequest{ctx: ctx, cancel: cancel}
}

// Cancel stops the request, including when it has not started yet.
func (request *PriceWidgetRequest) Cancel() {
	request.cancel()
}

// State fetches the selected quote. Call Cancel when the worker stops or completes.
func (request *PriceWidgetRequest) State(dataDir string, selectedIndex int, force bool) (string, error) {
	initialize(dataDir)
	state, err := widgetService.LoadContext(request.ctx, dataDir, selectedIndex, true, force)
	if err != nil {
		return "", err
	}
	data, err := json.Marshal(state)
	return string(data), err
}

// PriceWidgetState returns widget display data without starting the wallet server.
// Call on a background thread; network requests can take up to ten seconds.
func PriceWidgetState(dataDir string, selectedIndex int, fetch, force bool) (string, error) {
	initialize(dataDir)
	state, err := widgetService.Load(dataDir, selectedIndex, fetch, force)
	if err != nil {
		return "", err
	}
	data, err := json.Marshal(state)
	return string(data), err
}
