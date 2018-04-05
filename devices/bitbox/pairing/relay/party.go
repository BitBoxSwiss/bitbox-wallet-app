package relay

// party enumerates the endpoints of the pairing.
type party int

const (
	// desktop is the endpoint that is connected to the BitBox.
	desktop party = 0

	// mobile is the endpoint that acts as a trusted screen.
	mobile party = 1
)
