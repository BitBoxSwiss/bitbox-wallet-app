package pairing

const (
	// configFileName stores the name of the config file that contains the pairing information.
	configFileName = "config.dat"
)

type config struct {
	Version         int    `json:"version"`
	ChannelID       string `json:"comserverchannelid"`
	EncryptionKey   []byte `json:"encryptionprivkey"`
	Proxy           bool   `json:"dbb_proxy"`
	UseDefaultProxy bool   `json:"use_default_proxy"`
}

func newConfig(channel *Channel) *config {
	return &config{
		Version:         1,
		ChannelID:       channel.ChannelID,
		EncryptionKey:   channel.EncryptionKey,
		Proxy:           false,
		UseDefaultProxy: false,
	}
}

func (config *config) channel() *Channel {
	return NewChannel(config.ChannelID, config.EncryptionKey)
}
