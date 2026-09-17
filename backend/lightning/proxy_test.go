// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
	"github.com/stretchr/testify/require"
)

func TestProxyConfig(t *testing.T) {
	tests := []struct {
		name    string
		proxy   socksproxy.SocksProxy
		want    *breez_sdk_spark.ProxyConfig
		wantErr string
	}{
		{name: "zero value"},
		{name: "disabled", proxy: socksproxy.NewSocksProxy(false, "invalid:port")},
		{
			name:  "default",
			proxy: socksproxy.NewSocksProxy(true, ""),
			want:  &breez_sdk_spark.ProxyConfig{Host: "127.0.0.1", Port: 9050},
		},
		{
			name:  "custom",
			proxy: socksproxy.NewSocksProxy(true, "192.0.2.1:9150"),
			want:  &breez_sdk_spark.ProxyConfig{Host: "192.0.2.1", Port: 9150},
		},
		{
			name:  "hostname",
			proxy: socksproxy.NewSocksProxy(true, "localhost:9050"),
			want:  &breez_sdk_spark.ProxyConfig{Host: "localhost", Port: 9050},
		},
		{
			name:  "ipv6",
			proxy: socksproxy.NewSocksProxy(true, "[::1]:9050"),
			want:  &breez_sdk_spark.ProxyConfig{Host: "::1", Port: 9050},
		},
		{
			name:    "omitted port",
			proxy:   socksproxy.NewSocksProxy(true, "localhost"),
			wantErr: "Tor proxy must be a host and port",
		},
		{
			name:    "ipv6 omitted port",
			proxy:   socksproxy.NewSocksProxy(true, "[::1]"),
			wantErr: "Tor proxy must be a host and port",
		},
		{
			name:    "credentials are unsupported",
			proxy:   socksproxy.NewSocksProxy(true, "user:secret@localhost:9050"),
			wantErr: "Tor proxy must be a host and port",
		},
		{
			name:    "username is unsupported",
			proxy:   socksproxy.NewSocksProxy(true, "user@localhost:9050"),
			wantErr: "Tor proxy must be a host and port",
		},
		{
			name:    "URL is unsupported",
			proxy:   socksproxy.NewSocksProxy(true, "socks5://localhost:9050"),
			wantErr: "Tor proxy must be a host and port",
		},
		{
			name:    "missing host",
			proxy:   socksproxy.NewSocksProxy(true, ":9050"),
			wantErr: "Tor proxy must be a host and port",
		},
		{
			name:    "invalid port",
			proxy:   socksproxy.NewSocksProxy(true, "localhost:invalid"),
			wantErr: "Invalid Tor proxy port",
		},
		{
			name:    "port overflow",
			proxy:   socksproxy.NewSocksProxy(true, "localhost:65536"),
			wantErr: "Invalid Tor proxy port",
		},
		{
			name:    "zero port",
			proxy:   socksproxy.NewSocksProxy(true, "localhost:0"),
			wantErr: "Invalid Tor proxy port",
		},
		{
			name:    "malformed ipv6",
			proxy:   socksproxy.NewSocksProxy(true, "[::1:9050"),
			wantErr: "Tor proxy must be a host and port",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			lightning := &Lightning{socksProxy: test.proxy}
			proxyConfig, err := lightning.proxyConfig()
			if test.wantErr != "" {
				require.EqualError(t, err, test.wantErr)
				require.Nil(t, proxyConfig)
				return
			}
			require.NoError(t, err)
			require.Equal(t, test.want, proxyConfig)
		})
	}
}

func TestSparkStatusWithProxy(t *testing.T) {
	cfg := newTestLightning(t, nil).backendConfig
	lightning := NewLightning(cfg, t.TempDir(), nil, nil, nil, nil,
		socksproxy.NewSocksProxy(true, "[::1]:9150"), nil, nil)
	lightning.sparkStatus = func(request breez_sdk_spark.GetSparkStatusRequest) (breez_sdk_spark.SparkStatus, error) {
		require.Equal(t, &breez_sdk_spark.ProxyConfig{Host: "::1", Port: 9150}, request.Proxy)
		return breez_sdk_spark.SparkStatus{Status: breez_sdk_spark.ServiceStatusOperational}, nil
	}
	status, err := lightning.SparkStatus()
	require.NoError(t, err)
	require.Equal(t, &SparkStatus{Status: "operational"}, status)
}

func TestSparkStatusInvalidProxy(t *testing.T) {
	lightning := &Lightning{
		socksProxy: socksproxy.NewSocksProxy(true, "localhost:65536"),
		sparkStatus: func(breez_sdk_spark.GetSparkStatusRequest) (breez_sdk_spark.SparkStatus, error) {
			t.Fatal("Spark status must not be requested with an invalid proxy")
			return breez_sdk_spark.SparkStatus{}, nil
		},
	}
	status, err := lightning.SparkStatus()
	require.EqualError(t, err, "Invalid Tor proxy port")
	require.Nil(t, status)
}

func TestConnectInvalidProxy(t *testing.T) {
	lightning := newTestLightning(t, nil)
	lightning.socksProxy = socksproxy.NewSocksProxy(true, "localhost:65536")
	require.NoError(t, lightning.SetAccount(&config.LightningAccountConfig{Code: "test"}))

	require.EqualError(t, lightning.connect(), "Invalid Tor proxy port")
	require.Equal(t, SDKStatusFailed, lightning.SDKStatus())
}
