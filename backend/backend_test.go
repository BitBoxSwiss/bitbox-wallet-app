package backend_test

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/shiftdevices/godbb/coins/btc"
	"github.com/shiftdevices/godbb/util/jsonp"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/shiftdevices/godbb/backend"
	"github.com/shiftdevices/godbb/backend/handlers"

	walletHandlers "github.com/shiftdevices/godbb/coins/btc/handlers"
)

const (
	electrumServerBitcoinRegtest = "127.0.0.1:52001"
)

func executeBitcoinCLICommand(cmd string) []byte {
	cmd = fmt.Sprintf(
		"docker exec -i bitcoind-regtest bitcoin-cli -regtest -rpcuser=dbb -rpcpassword=dbb -rpcport=10332 %s",
		cmd)
	log.Printf("> %s\n", cmd)
	output, err := exec.Command("/bin/sh", "-c", cmd).Output()
	if err != nil {
		panic(err)
	}
	log.Printf("< %s", output)
	return output
}

// generateBlocks generates `n` blocks.
func generateBlocks(n int) {
	_ = executeBitcoinCLICommand(fmt.Sprintf("generate %d", n))
}

// sendToAddress sends funds to the address and returns the txID.
func sendToAddress(address string, amountBTC float64) *chainhash.Hash {
	hash, err := chainhash.NewHashFromStr(strings.TrimSpace(
		string(executeBitcoinCLICommand(
			fmt.Sprintf("sendtoaddress %s %s", address, fmt.Sprintf("%.8f", amountBTC))))))
	if err != nil {
		panic(err)
	}
	return hash
}

type backendTestSuite struct {
	suite.Suite

	router    *mux.Router
	server    *httptest.Server
	websocket *websocket.Conn
}

func (s *backendTestSuite) SetupSuite() {
	connectionData := handlers.NewConnectionData(8082, "")
	s.router = handlers.NewHandlers(backend.NewBackendForTesting(true), connectionData).Router
	s.server = httptest.NewServer(s.router)

	url := "ws" + strings.TrimPrefix(s.server.URL, "http") + "/api/events"
	ws, _, err := websocket.DefaultDialer.Dial(url, nil)
	require.NoError(s.T(), err)
	s.websocket = ws
	require.NoError(s.T(), s.websocket.WriteMessage(websocket.TextMessage, []byte("Authorization: Basic ")))
}

func (s *backendTestSuite) TearDownSuite() {
	require.NoError(s.T(), s.websocket.Close())
	s.server.Close()
}

// TestBackendTestSuite can be run with the following command in order to get its output:
// 'go test github.com/shiftdevices/godbb/backend -run ^TestBackendTestSuite$ -v'.
func TestBackendTestSuite(t *testing.T) {
	if os.Getenv("FUNCTIONAL_TEST") != "1" {
		t.Skip(fmt.Sprintf(
			"Skipping backend functional test because there is no electrumx regtest instance running at %s",
			electrumServerBitcoinRegtest))
		return
	}

	suite.Run(t, new(backendTestSuite))
}

// Returns the body of the response to a request with the given method to the given path with the given body.
func (s *backendTestSuite) request(method, path, body string) string {
	reader := strings.NewReader(body)
	request := httptest.NewRequest(method, path, reader)
	response := httptest.NewRecorder()
	s.router.ServeHTTP(response, request)
	require.Equal(s.T(), http.StatusOK, response.Code, "Received an invalid response code.")
	return response.Body.String()
}

// Returns the body of the response to a GET request to the given path.
func (s *backendTestSuite) get(path string) string {
	return s.request("GET", path, "")
}

// Returns the body of the response to a POST request to the given path with the given body.
func (s *backendTestSuite) post(path, body string) string {
	return s.request("POST", path, body)
}

// Waits for the given wallet event to be received through the websocket to the backend.
func (s *backendTestSuite) waitForWalletEvent(expectedEvent backend.WalletEvent) {
	for {
		_, message, err := s.websocket.ReadMessage()
		require.NoError(s.T(), err)
		var receivedEvent backend.WalletEvent
		err = json.Unmarshal(message, &receivedEvent)
		// Unmarshal fails if the message is not a wallet event.
		if err == nil && receivedEvent == expectedEvent {
			break
		}
	}
}

func (s *backendTestSuite) waitSyncDone() {
	s.waitForWalletEvent(backend.WalletEvent{
		Type: "wallet",
		Code: "rbtc",
		Data: string(btc.EventSyncDone),
	})
}

func marshal(value interface{}) string {
	return string(jsonp.MustMarshal(value))
}

func (s *backendTestSuite) TestBackend() {
	require.JSONEq(s.T(),
		marshal("0.1.0"),
		s.get("/api/version"),
	)

	require.JSONEq(s.T(),
		marshal(true),
		s.post("/api/devices/test/register", ""),
	)

	require.JSONEq(s.T(),
		marshal(map[string]bool{"success": true}),
		s.post("/api/device/login", marshal(map[string]string{
			"password": "Only use this password in backend_test.go!",
		})),
	)

	s.waitForWalletEvent(backend.WalletEvent{
		Type: "wallet",
		Code: "rbtc",
		Data: string(btc.EventSyncDone),
	})

	require.JSONEq(s.T(),
		marshal(map[string]interface{}{
			"available":   "0 BTC",
			"hasIncoming": false,
			"incoming":    "0 BTC",
		}),
		s.get("/api/wallet/rbtc/balance"),
	)

	require.JSONEq(s.T(),
		marshal("mjF1xSgSjYxLBrRNCowvcMtrSFUF7ENtzy"),
		s.get("/api/wallet/rbtc/receive-address"),
	)

	// Create >100 blocks to mature the coinbase.
	generateBlocks(101)

	// Electrumx bug: it doesn't notify us of unconfirmed changes in the address, but only for
	// unconfirmed tx using outputs from just created blocks. See
	// https://github.com/kyuupichan/electrumx/issues/433.  Workaround until fixed: give the server
	// a bit of time to flush the blocks. The bug is not relevant in production, because the
	// condition unlikely and fixes itself with a confirmation.
	time.Sleep(5 * time.Second)
	txID := sendToAddress("mjF1xSgSjYxLBrRNCowvcMtrSFUF7ENtzy", 10)

	s.waitSyncDone()
	require.JSONEq(s.T(),
		marshal(map[string]interface{}{
			"available":   "0 BTC",
			"hasIncoming": true,
			"incoming":    "10 BTC",
		}),
		s.get("/api/wallet/rbtc/balance"),
	)

	// Confirm it.
	generateBlocks(1)

	s.waitSyncDone()
	require.JSONEq(s.T(),
		marshal(map[string]interface{}{
			"available":   "10 BTC",
			"hasIncoming": false,
			"incoming":    "0 BTC",
		}),
		s.get("/api/wallet/rbtc/balance"),
	)

	require.JSONEq(s.T(),
		marshal(
			[]walletHandlers.Transaction{{
				ID:     txID.String(),
				Height: 102,
				Type:   "receive",
				Amount: "10 BTC",
				Fee:    "",
			}},
		),
		s.get("/api/wallet/rbtc/transactions"),
	)
}
