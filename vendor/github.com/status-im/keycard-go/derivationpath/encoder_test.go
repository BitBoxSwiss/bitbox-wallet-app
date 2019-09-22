package derivationpath

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEncode(t *testing.T) {
	scenarios := []struct {
		path         []uint32
		expectedPath string
	}{
		{
			path:         []uint32{},
			expectedPath: "m",
		},
		{
			path:         []uint32{0, 1, 2},
			expectedPath: "m/0/1/2",
		},
		{
			path:         []uint32{hardenedStart + 10, 1, 2},
			expectedPath: "m/10'/1/2",
		},
	}

	for i, s := range scenarios {
		t.Run(fmt.Sprintf("scenario %d", i), func(t *testing.T) {
			path := Encode(s.path)
			assert.Equal(t, s.expectedPath, path)
		})
	}
}
