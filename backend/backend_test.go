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
			"unit":        "RBTC",
		}),
		s.get("/api/wallet/rbtc/balance"),
	)

	receiveAddresses := []map[string]string{map[string]string{"address": "mjF1xSgSjYxLBrRNCowvcMtrSFUF7ENtzy", "scriptHashHex": "a4c4d7b1e4698da3ffd9f6c5ef231c9f616ba3eb2654baff02dc77efd4777627"}, map[string]string{"address": "n2o5FgGCZfFF3Uq5cbhKjBRniQfGUpfsWb", "scriptHashHex": "ddfd15ae1144a3c74cbaaa603049ea5cf2a9bc8adfee0c513a9ef64024d2cbfe"}, map[string]string{"address": "myicnyEGxG2z8wQAd5ba7sdQkx9ZftdEeg", "scriptHashHex": "6a3a0cfe54cbf62fe4bc606843f2b45bf54516be37a2ff856cd96a322df92bab"}, map[string]string{"address": "mkoY2p4tsPSH2sibm4XwhRKFK8g6yuJRkR", "scriptHashHex": "3e94105137e5a3395a656c62e8e777f83520fbcf7d5e0bd3476c09115b24e03b"}, map[string]string{"address": "mvV7GSKVu6oa52PjnSnANkmsmRY3YSYU8n", "scriptHashHex": "3b9bd1de479b092452c9e9f214c592e906ae22f5bffd9e8432a666677f1839b1"}, map[string]string{"scriptHashHex": "cf5f1a9b4871b0201750711c896073a087df1af98d161fbf2fd8e6e29f562f15", "address": "mnU7a6QVGx7Wivkz5Cq34gwGGB3XG9kgUC"}, map[string]string{"address": "mnGpKExLFW6wRcrGfv9KC5nmLLx9qM7mHo", "scriptHashHex": "3cd6385b4b6f33b58723fdd2bfc577a1d4716ec361cc01405a9011b794181f9e"}, map[string]string{"address": "mpC28pqUmwPpTKst32UwisyDeGmA6c7NFe", "scriptHashHex": "7bb828c6eb63de48ce9017303c66a6db5f119080a360e56d9da9399c84c6caf7"}, map[string]string{"address": "mx8uWPCvgNfkpeZt8gxN7URNTXe88C2a2n", "scriptHashHex": "05b2c82c3893b2acbe5afd87d9cb324530161894cdbab59930c2aac8d033f4bd"}, map[string]string{"address": "mgs57V9zuWRFSv1VtdEWAX2mHzg8vmpaZc", "scriptHashHex": "4d45a55243e621d19d4d6bce79e489b2c5c99f9d71127ff2ed683c5aedd83810"}, map[string]string{"address": "mjCiZ2T1e5MCiddsamP5bM6jNXys4jjgLj", "scriptHashHex": "a8062c7e5ca2f952225fa70517b0f1ac3208f181f6f16eed2e65e8b615807352"}, map[string]string{"address": "mkpa4bDpFjZw4naFEvTb76uUghvqiXzn6q", "scriptHashHex": "7ea1f4014f9d0f6d5a15056b7f00fc1ec264a51776fba3026342f10e2ca3e834"}, map[string]string{"address": "muXaSLPPqAv3gpqxEacNZYz7nmVbLUmpJD", "scriptHashHex": "f0a7f942b2b1f3e7bbbdd7adbf6549196fd86be75b343f38a7b382a663f4c908"}, map[string]string{"address": "mqncwV1QGYayzgoSa24BRqDVsCsVWbmdi7", "scriptHashHex": "cc27c103a3eeb60e83e399510bd23a2f762ace779c4817cbd29568fd0ca69720"}, map[string]string{"address": "ms8PvFNtEXUmc5Y7N41axsAS18eHB1UwsU", "scriptHashHex": "2bb3a380708c0d157df3732c67a7fc5859a879ecf06deb7321f34da254edfea8"}, map[string]string{"address": "mwrASMSjt3HtsQ8NnSYhes3uu2etZgSoRP", "scriptHashHex": "84451b81094662aeda34dfeea9a8eff31b0e182e3395dedca73f281217fdd782"}, map[string]string{"address": "mgXv3LuqQMXhNHLxBfPnMos7NSWXvRwyez", "scriptHashHex": "f40efb0d47607569a87d5aa1096a869ac6b719d982e81a5522ff48c95027e890"}, map[string]string{"address": "miWXvXxCaFCVPn5ZdqDBneZrFjJfuQM8s9", "scriptHashHex": "88a73a6aa5f684d6f26d3127d8bfa81700551d9dd2c10afad1e01cc7e8d450e1"}, map[string]string{"address": "mnrpu3cMko5yi7VwP2c1rYKNZjVdszSupD", "scriptHashHex": "3a3c40a6ec73f37796047394f542e4b397e42a48af2aea4d069ea970cb051457"}, map[string]string{"address": "n1TAuTgoauN5HWPhz4Hp4ZFVhYvwQKP9gh", "scriptHashHex": "7481cd898f37d101df48557e8e8c66617e436582d9f9b56dd995f0adc015f511"}}
	require.JSONEq(s.T(),
		marshal(receiveAddresses),
		s.get("/api/wallet/rbtc/receive-addresses"),
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
	txID := sendToAddress(receiveAddresses[0]["address"], 10)

	s.waitForWalletEvent(btc.EventSyncDone)
	require.JSONEq(s.T(),
		marshal(map[string]interface{}{
			"available":   "0",
			"hasIncoming": true,
			"incoming":    "10",
			"unit":        "RBTC",
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
			"unit":        "RBTC",
		}),
		s.get("/api/wallet/rbtc/balance"),
	)

	txTime := time.Unix(confirmBlockHeader.Time, 0).Format(time.RFC3339)
	require.JSONEq(s.T(),
		marshal(
			[]walletHandlers.Transaction{{
				ID:               txID.String(),
				NumConfirmations: 1,
				Height:           102,
				Type:             "receive",
				Amount:           "10 RBTC",
				Fee:              "",
				Time:             &txTime,
				Addresses:        []string{receiveAddresses[0]["address"]},
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
