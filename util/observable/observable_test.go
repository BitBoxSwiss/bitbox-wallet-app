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
	event := &observable.Event{Subject: "subject", Action: action.Replace, Object: "object"}
	listener := func(event *observable.Event) { counter++ }
	implementation.RegisterEventListener(&listener)
	implementation.NotifyListeners(event)
	assert.Equal(t, 1, counter)
	implementation.DeregisterEventListener(&listener)
	implementation.NotifyListeners(event)
	assert.Equal(t, 1, counter)
}
