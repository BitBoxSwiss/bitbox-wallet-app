// SPDX-License-Identifier: Apache-2.0

package handlers

import "sync"

const eventChannelBufferSize = 1000

// eventBroker fans out events to multiple subscribers. Each subscriber gets its own buffered
// channel. If a subscriber's channel is full, events are dropped for that subscriber to avoid
// blocking other subscribers or the publisher.
//
// Events published before any subscriber connects are buffered (up to eventChannelBufferSize) and
// replayed to the first subscriber that connects. This prevents a race where events (e.g.
// auth-result) are lost because the WebSocket client hasn't connected yet.
type eventBroker struct {
	mu          sync.Mutex
	subscribers map[int]chan interface{}
	nextID      int
	// earlyEvents buffers events published before the first subscriber connects. Once the first
	// subscriber is added, this slice is drained into its channel and set to nil.
	earlyEvents []interface{}
}

func newEventBroker() *eventBroker {
	return &eventBroker{
		subscribers: make(map[int]chan interface{}),
		earlyEvents: make([]interface{}, 0),
	}
}

// subscribe registers a new subscriber and returns an ID (for unsubscribe) and a channel to
// receive events on.
func (b *eventBroker) subscribe() (int, <-chan interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()
	id := b.nextID
	b.nextID++
	ch := make(chan interface{}, eventChannelBufferSize)
	// Replay early events to the first subscriber, then discard the buffer.
	if b.earlyEvents != nil {
		for _, event := range b.earlyEvents {
			select {
			case ch <- event:
			default:
			}
		}
		b.earlyEvents = nil
	}
	b.subscribers[id] = ch
	return id, ch
}

// unsubscribe removes a subscriber and closes its channel.
func (b *eventBroker) unsubscribe(id int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if ch, ok := b.subscribers[id]; ok {
		delete(b.subscribers, id)
		close(ch)
	}
}

// publish sends an event to all subscribers. Non-blocking: if a subscriber's buffer is full, the
// event is dropped for that subscriber.
func (b *eventBroker) publish(event interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.subscribers) == 0 && b.earlyEvents != nil {
		if len(b.earlyEvents) < eventChannelBufferSize {
			b.earlyEvents = append(b.earlyEvents, event)
		}
		return
	}
	for _, ch := range b.subscribers {
		select {
		case ch <- event:
		default:
			// Drop event for slow subscriber to avoid blocking others.
		}
	}
}
