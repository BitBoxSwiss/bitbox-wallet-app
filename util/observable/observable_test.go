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

package observable_test

import (
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/stretchr/testify/assert"
)

func TestObservable(t *testing.T) {
	counter := 0
	implementation := &observable.Implementation{}
	event := observable.Event{Subject: "subject", Action: action.Replace, Object: "object"}
	unobserve := implementation.Observe(func(observable.Event) { counter++ })
	implementation.Observe(func(observable.Event) {})
	implementation.Notify(event)
	assert.Equal(t, 1, counter)
	unobserve()
	implementation.Notify(event)
	assert.Equal(t, 1, counter)
}
