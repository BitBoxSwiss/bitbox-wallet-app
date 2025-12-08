package swapkit

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

// Client is a SwapKit client that can be used to interact with
// SwapKit API.
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	log        *logrus.Entry
}

// NewClient returns a new swapkit client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:  apiKey,
		baseURL: "https://api.swapkit.dev",
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
		log: logging.Get().WithGroup("swapkit"),
	}
}

func (c *Client) post(ctx context.Context, path string, body any, out any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("x-api-key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http error: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			c.log.WithError(err).Error("Error closing response body")
		}
	}()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("swapkit error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	if err := json.Unmarshal(bodyBytes, out); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	return nil
}
