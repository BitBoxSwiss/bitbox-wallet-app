// SPDX-License-Identifier: Apache-2.0

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
