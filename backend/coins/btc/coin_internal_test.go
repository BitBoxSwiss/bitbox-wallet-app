// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
