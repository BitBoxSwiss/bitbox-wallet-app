// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"net"
	"strconv"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
)

func (lightning *Lightning) proxyConfig() (*breez_sdk_spark.ProxyConfig, error) {
	proxyAddress := lightning.socksProxy.GetProxyAddress()
	if proxyAddress == "" {
		return nil, nil
	}
	host, portString, err := net.SplitHostPort(proxyAddress)
	if err != nil || host == "" || strings.ContainsAny(host, "@/?#") {
		return nil, errp.New("Tor proxy must be a host and port")
	}
	port, err := strconv.ParseUint(portString, 10, 16)
	if err != nil || port == 0 {
		return nil, errp.New("Invalid Tor proxy port")
	}
	return &breez_sdk_spark.ProxyConfig{
		Host: host,
		Port: uint16(port),
	}, nil
}
