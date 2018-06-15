package btc

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFormatAsCurrency(t *testing.T) {
	assert.Equal(t, "1.00", formatAsCurrency(1))
	assert.Equal(t, "12.34", formatAsCurrency(12.34321))
	assert.Equal(t, "1'234.56", formatAsCurrency(1234.555))
	assert.Equal(t, "12'345'678.90", formatAsCurrency(12345678.9))
}
