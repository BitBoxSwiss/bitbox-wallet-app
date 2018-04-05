package relay

// data models the content of a successful response.
type data struct {
	ID      int    `json:"id"`
	Age     int    `json:"age"`
	Payload string `json:"payload"`
}

// response models a response from the relay server.
type response struct {
	// Either "ok" or "nok".
	Status string `json:"status"`

	// Only if status is "ok" (and can even then be nil).
	Data []data `json:"data,omitempty"`

	// Only if status is "nok" (and then not nil).
	Error *string `json:"error,omitempty"`
}
