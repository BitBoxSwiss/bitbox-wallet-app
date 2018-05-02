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
	"github.com/shiftdevices/godbb/backend/coins/btc"
	walletHandlers "github.com/shiftdevices/godbb/backend/coins/btc/handlers"
	"github.com/shiftdevices/godbb/util/jsonp"
	"github.com/shiftdevices/godbb/util/test"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/shiftdevices/godbb/backend"
	"github.com/shiftdevices/godbb/backend/handlers"
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

// generateBlocks generates `n` blocks. Returns the generated block hashes.
func generateBlocks(n int) []string {
	jsonBytes := executeBitcoinCLICommand(fmt.Sprintf("generate %d", n))
	hashes := []string{}
	jsonp.MustUnmarshal(jsonBytes, &hashes)
	return hashes
}

type header struct {
	Time int64 `json:"time"`
}

// blockHeader gets the block header.
func blockHeader(blockHash string) *header {
	jsonBytes := executeBitcoinCLICommand(fmt.Sprintf("getblockheader %s", blockHash))
	header := &header{}
	jsonp.MustUnmarshal(jsonBytes, header)
	return header
}

// invalidateBlock marks a block as invalid. Useful to create reorganizations.
func invalidateBlock(blockHash string) {
	_ = executeBitcoinCLICommand(fmt.Sprintf("invalidateblock %s", blockHash))
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
	arguments := backend.NewArguments(test.TstTempDir("godbb-functional-tests-"), true, true, false)
	backend := backend.NewBackend(arguments)
	s.router = handlers.NewHandlers(backend, connectionData).Router
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
func (s *backendTestSuite) waitForEvent(expectedEvent backend.WalletEvent) {
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

func (s *backendTestSuite) waitForWalletEvent(event btc.Event) {
	s.waitForEvent(backend.WalletEvent{
		Type: "wallet",
		Code: "rbtc",
		Data: string(event),
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
		s.post("/api/test/register",
			marshal(map[string]string{"pin": "Only use this password in backend_test.go!"})),
	)

	s.waitForWalletEvent(btc.EventSyncDone)

	require.JSONEq(s.T(),
		marshal(map[string]interface{}{
			"available":   "0",
			"hasIncoming": false,
			"incoming":    "0",
			"unit":        "BTC",
		}),
		s.get("/api/wallet/rbtc/balance"),
	)

	receiveAddress := "mjF1xSgSjYxLBrRNCowvcMtrSFUF7ENtzy"
	require.JSONEq(s.T(),
		marshal(receiveAddress),
		s.get("/api/wallet/rbtc/receive-address"),
	)

	// Create >100 blocks to mature the coinbase.
	generateBlocks(101)
	s.waitForWalletEvent(btc.EventHeadersSynced)

	// Electrumx bug: it doesn't notify us of unconfirmed changes in the address, but only for
	// unconfirmed tx using outputs from just created blocks. See
	// https://github.com/kyuupichan/electrumx/issues/433.  Workaround until fixed: give the server
	// a bit of time to flush the blocks. The bug is not relevant in production, because the
	// condition unlikely and fixes itself with a confirmation.
	time.Sleep(5 * time.Second)
	txID := sendToAddress(receiveAddress, 10)

	s.waitForWalletEvent(btc.EventSyncDone)
	require.JSONEq(s.T(),
		marshal(map[string]interface{}{
			"available":   "0",
			"hasIncoming": true,
			"incoming":    "10",
			"unit":        "BTC",
		}),
		s.get("/api/wallet/rbtc/balance"),
	)

	// Confirm it.
	confirmBlockHash := generateBlocks(1)[0]
	confirmBlockHeader := blockHeader(confirmBlockHash)
	s.waitForWalletEvent(btc.EventHeadersSynced)

	s.waitForWalletEvent(btc.EventSyncDone)
	require.JSONEq(s.T(),
		marshal(map[string]interface{}{
			"available":   "10",
			"hasIncoming": false,
			"incoming":    "0",
			"unit":        "BTC",
		}),
		s.get("/api/wallet/rbtc/balance"),
	)

	txTime := time.Unix(confirmBlockHeader.Time, 0).String()
	require.JSONEq(s.T(),
		marshal(
			[]walletHandlers.Transaction{{
				ID:        txID.String(),
				Height:    102,
				Type:      "receive",
				Amount:    "10 BTC",
				Fee:       "",
				Time:      &txTime,
				Addresses: []string{receiveAddress},
			}},
		),
		s.get("/api/wallet/rbtc/transactions"),
	)

	// Test headers.
	blockHashes := generateBlocks(100)
	s.waitForWalletEvent(btc.EventHeadersSynced)
	expectedHeadersStatus := marshal(map[string]interface{}{
		"tip":          202,
		"targetHeight": 202,
		"tipHashHex":   blockHashes[99],
	})
	require.JSONEq(s.T(),
		expectedHeadersStatus,
		s.get("/api/wallet/rbtc/headers/status"),
	)
	// Test reorg.
	// Invalidate 52 blocks and add a new one. Our backend still has the longest chain and ignores
	// it (so there is also no HeadersSynced event).
	invalidateBlock(blockHashes[50])
	_ = generateBlocks(1)
	require.JSONEq(s.T(),
		expectedHeadersStatus,
		s.get("/api/wallet/rbtc/headers/status"),
	)
	// After generating 50 more blocks, we arrive at 203 blocks, longer than the previously longest
	// chain. Since it is a different chain, we expect correct reorganization.
	blockHashes = generateBlocks(50)
	s.waitForWalletEvent(btc.EventHeadersSynced)
	require.JSONEq(s.T(),
		marshal(map[string]interface{}{
			"tip":          203,
			"targetHeight": 203,
			"tipHashHex":   blockHashes[49],
		}),
		s.get("/api/wallet/rbtc/headers/status"),
	)
}
