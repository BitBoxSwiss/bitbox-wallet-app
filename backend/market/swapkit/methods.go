package swapkit

import (
	"context"
)

// Quote performs a SwapKit V3 quote request.
func (c *Client) Quote(ctx context.Context, req *QuoteRequest) (*QuoteResponse, error) {
	var resp QuoteResponse
	if err := c.post(ctx, "/v3/quote", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// Swap performs a SwapKit V3 swap request.
func (c *Client) Swap(ctx context.Context, req *SwapRequest) (*SwapResponse, error) {
	var resp SwapResponse
	if err := c.post(ctx, "/v3/swap", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// Track performs a SwapKit track request.
func (c *Client) Track(ctx context.Context, req *TrackRequest) (*TrackResponse, error) {
	var resp TrackResponse
	if err := c.post(ctx, "/track", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}
