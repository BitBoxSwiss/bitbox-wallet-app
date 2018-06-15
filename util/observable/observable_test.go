package observable_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/shiftdevices/godbb/util/observable"
	"github.com/shiftdevices/godbb/util/observable/action"
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
