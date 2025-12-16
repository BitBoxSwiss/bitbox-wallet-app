// SPDX-License-Identifier: Apache-2.0

package observable

// Interface can be embedded in interfaces that are observable.
type Interface interface {
	// Observe registers the given callback and returns a function to unobserve again.
	Observe(func(Event)) func()
}
