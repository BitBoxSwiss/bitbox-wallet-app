package swapkit

import (
	"context"
)

// Quote performs a SwapKit V3 quote request.
func (c *Client) Quote(ctx context.Context, req *QuoteRequest) (*QuoteResponse, error) {
	var resp QuoteResponse
	if err := c.post(ctx, "/quote", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}
