package globalplatform

// SCP02Keys is a struct that contains encoding and MAC keys used to communicate with smartcards.
type SCP02Keys struct {
	enc []byte
	mac []byte
}

// Enc returns the enc key data.
func (k *SCP02Keys) Enc() []byte {
	return k.enc
}

// Mac returns the MAC key data.
func (k *SCP02Keys) Mac() []byte {
	return k.mac
}

// NewSCP02Keys returns a new SCP02Keys with the specified ENC and MAC keys.
func NewSCP02Keys(enc, mac []byte) *SCP02Keys {
	return &SCP02Keys{
		enc: enc,
		mac: mac,
	}
}
