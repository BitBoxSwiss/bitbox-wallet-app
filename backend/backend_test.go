package backend_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"

	"github.com/shiftdevices/godbb/backend"
	"github.com/shiftdevices/godbb/backend/handlers"
	"github.com/shiftdevices/godbb/util/jsonp"
)

var router = handlers.NewHandlers(backend.NewBackend(), 8082).Router

func executeRequest(request *http.Request) *httptest.ResponseRecorder {
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

// Returns the body of the response to a request with the given method to the given path with the given body.
func request(method, path, body string) string {
	reader := strings.NewReader(body)
	request := httptest.NewRequest(method, path, reader)
	response := executeRequest(request)
	if response.Code != http.StatusOK {
		panic(fmt.Sprintf("The response code was %d instead of %d.\n", response.Code, http.StatusOK))
	}
	return response.Body.String()
}

// Returns the body of the response to a GET request to the given path.
func get(path string) string {
	return request("GET", path, "")
}

// Returns the body of the response to a POST request to the given path with the given body.
func post(path, body string) string {
	return request("POST", path, body)
}

func marshal(value interface{}) string {
	return string(jsonp.MustMarshal(value))
}

func printReceivedEvents(t *testing.T, ws *websocket.Conn) {
	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			if !strings.HasSuffix(err.Error(), "use of closed network connection") {
				t.Fatalf("%v", err)
			}
			break
		} else {
			fmt.Println("Received event: " + string(message))
		}
	}
}

// TestBackend can be run with 'go test github.com/shiftdevices/godbb/backend -run ^TestBackend$ -v'.
func TestBackend(t *testing.T) {
	server := httptest.NewServer(router)
	defer server.Close()

	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/events"
	ws, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("%v", err)
	}
	defer ws.Close()

	go printReceivedEvents(t, ws)

	require.JSONEq(t, marshal("0.1.0"), get("/api/version"))
	require.Equal(t, "null\n", post("/api/devices/test/register", "new"))
	require.JSONEq(t, marshal(map[string]bool{"success": true}), post("/api/device/login", marshal(map[string]string{"password": "pw"})))
	time.Sleep(time.Second) // The wallets need to initialize first.
	balance := marshal(map[string]interface{}{"available": "0 BTC", "hasIncoming": false, "incoming": "0 BTC"})
	require.JSONEq(t, balance, get("/api/wallet/tbtc/balance"))
}
