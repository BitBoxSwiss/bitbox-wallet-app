package relay

const (
	// configFileName stores the name of the config file that contains the pairing information.
	configFileName = "config.dat"
)

type configuration struct {
	Version         int    `json:"version"`
	ChannelID       string `json:"comserverchannelid"`
	EncryptionKey   []byte `json:"encryptionprivkey"`
	Proxy           bool   `json:"dbb_proxy"`
	UseDefaultProxy bool   `json:"use_default_proxy"`
}

func newConfiguration(channel *Channel) *configuration {
	return &configuration{
		Version:         1,
		ChannelID:       channel.ChannelID,
		EncryptionKey:   channel.EncryptionKey,
		Proxy:           false,
		UseDefaultProxy: false,
	}
}

func (configuration *configuration) channel() *Channel {
	return NewChannel(configuration.ChannelID, configuration.EncryptionKey)
}
