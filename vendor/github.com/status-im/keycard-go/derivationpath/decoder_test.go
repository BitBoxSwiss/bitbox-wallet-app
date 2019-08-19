package derivationpath

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDecode(t *testing.T) {
	scenarios := []struct {
		path                  string
		expectedPath          []uint32
		expectedStartingPoint StartingPoint
		err                   error
	}{
		{
			path:                  "",
			expectedPath:          []uint32{},
			expectedStartingPoint: StartingPointCurrent,
		},
		{
			path:                  "1",
			expectedPath:          []uint32{1},
			expectedStartingPoint: StartingPointCurrent,
		},
		{
			path:                  "..",
			expectedPath:          []uint32{},
			expectedStartingPoint: StartingPointParent,
		},
		{
			path:                  "m",
			expectedPath:          []uint32{},
			expectedStartingPoint: StartingPointMaster,
		},
		{
			path:                  "m/1",
			expectedPath:          []uint32{1},
			expectedStartingPoint: StartingPointMaster,
		},
		{
			path:                  "m/1/2",
			expectedPath:          []uint32{1, 2},
			expectedStartingPoint: StartingPointMaster,
		},
		{
			path:                  "m/1/2'/3",
			expectedPath:          []uint32{1, 2147483650, 3},
			expectedStartingPoint: StartingPointMaster,
		},
		{
			path: "m/",
			err:  fmt.Errorf("at position 2, expected number, got EOF"),
		},
		{
			path: "m/1//2",
			err:  fmt.Errorf("at position 5, expected number, got /"),
		},
		{
			path: "m/1'2",
			err:  fmt.Errorf("at position 5, expected /, got 2"),
		},
		{
			path: "m/'/2",
			err:  fmt.Errorf("at position 3, expected number, got '"),
		},
		{
			path: "m/2147483648",
			err:  fmt.Errorf("at position 3, index must be lower than 2^31, got 2147483648"),
		},
	}

	for i, s := range scenarios {
		t.Run(fmt.Sprintf("scenario %d", i), func(t *testing.T) {
			startingPoint, path, err := Decode(s.path)
			if s.err == nil {
				assert.NoError(t, err)
				assert.Equal(t, s.expectedStartingPoint, startingPoint)
				assert.Equal(t, s.expectedPath, path)
			} else {
				assert.Equal(t, s.err, err)
			}
		})
	}
}
