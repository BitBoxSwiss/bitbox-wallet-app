// SPDX-License-Identifier: Apache-2.0

package relay

import "github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"

type configuration struct {
	ChannelID         string `json:"channel"`
	EncryptionKey     []byte `json:"encryption"`
	AuthenticationKey []byte `json:"authentication"`
}

func newConfiguration(channel *Channel) *configuration {
	return &configuration{
		ChannelID:         channel.ChannelID,
		EncryptionKey:     channel.EncryptionKey,
		AuthenticationKey: channel.AuthenticationKey,
	}
}

func (config *configuration) channel() *Channel {
	return NewChannel(config.ChannelID, config.EncryptionKey, config.AuthenticationKey, socksproxy.NewSocksProxy(false, ""))
}
