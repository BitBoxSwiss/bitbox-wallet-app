package swapkit

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

// Client is a client for the SwapKit API.
type Client struct {
	baseURL    string
	httpClient *http.Client
	log        *logrus.Entry
}

// NewClient creates a new SwapKit API client.
func NewClient(httpClient *http.Client) *Client {
	return &Client{
		baseURL:    "https://swapkit.shiftcrypto.io/v3",
		httpClient: httpClient,
		log:        logging.Get().WithGroup("swapkit"),
	}
}

func (c *Client) post(ctx context.Context, path string, body any, out any) error {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	b, err := json.Marshal(body)
	if err != nil {
		return errp.Wrap(err, "marshal request")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(b))
	if err != nil {
		return errp.Wrap(err, "create request")
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return errp.Wrap(err, "http error")
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			c.log.WithError(err).Error("failed to close response body")
		}
	}()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return errp.Wrap(err, "read response")
	}

	if resp.StatusCode >= http.StatusBadRequest {
		return errp.Newf("swapkit error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	if err := json.Unmarshal(bodyBytes, out); err != nil {
		return errp.Wrap(err, "decode response")
	}

	return nil
}
