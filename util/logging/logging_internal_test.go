package logging

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSetupLogger(t *testing.T) {
	const config = `
output: "test/output.log"
base-threshold: ERROR
`
	log, err := setup([]byte(config))
	require.NoError(t, err)
	require.Equal(t, log.BaseThreshold(), "ERROR")
	require.Equal(t, log.Output(), "test/output.log")
}
