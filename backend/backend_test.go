package backend_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/shiftdevices/godbb/coins/btc"
	"github.com/shiftdevices/godbb/util/jsonp"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/shiftdevices/godbb/backend"
	"github.com/shiftdevices/godbb/backend/handlers"
)

type backendTestSuite struct {
	suite.Suite

	router    *mux.Router
	server    *httptest.Server
	websocket *websocket.Conn
}

func (s *backendTestSuite) SetupSuite() {
	connectionData := handlers.NewConnectionData(8082, "")
	s.router = handlers.NewHandlers(backend.NewBackendForTesting(), connectionData).Router
	s.server = httptest.NewServer(s.router)

	url := "ws" + strings.TrimPrefix(s.server.URL, "http") + "/api/events"
	ws, _, err := websocket.DefaultDialer.Dial(url, nil)
	require.NoError(s.T(), err)
	s.websocket = ws
	require.NoError(s.T(), s.websocket.WriteMessage(websocket.TextMessage, []byte("Authorization: Basic ")))
}

func (s *backendTestSuite) TearDownSuite() {
	err := s.websocket.Close()
	require.NoError(s.T(), err)
	s.server.Close()
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
		if err != nil {
			break
		}
		var receivedEvent backend.WalletEvent
		err = json.Unmarshal(message, &receivedEvent)
		// Unmarshal fails if the message is not a wallet event.
		if err == nil && receivedEvent == expectedEvent {
			break
		}
	}
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
		Code: "tbtc",
		Data: string(btc.EventSyncDone),
	})

	require.JSONEq(s.T(),
		marshal(map[string]interface{}{
			"available":   "0 BTC",
			"hasIncoming": false,
			"incoming":    "0 BTC",
		}),
		s.get("/api/wallet/tbtc/balance"),
	)

	require.JSONEq(s.T(),
		marshal("mjF1xSgSjYxLBrRNCowvcMtrSFUF7ENtzy"),
		s.get("/api/wallet/tbtc/receive-address"),
	)
}

// TestBackendTestSuite can be run with the following command in order to get its output:
// 'go test github.com/shiftdevices/godbb/backend -run ^TestBackendTestSuite$ -v'.
func TestBackendTestSuite(t *testing.T) {
	suite.Run(t, new(backendTestSuite))
}
