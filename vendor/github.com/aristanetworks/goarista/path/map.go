// Copyright (c) 2017 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package path

import (
	"fmt"
	"sort"
	"strings"

	"github.com/aristanetworks/goarista/key"
)

// Map associates paths to values. It allows wildcards. A Map
// is primarily used to register handlers with paths that can
// be easily looked up each time a path is updated.
type Map struct {
	val      interface{}
	ok       bool
	wildcard *Map
	children map[key.Key]*Map
}

// VisitorFunc is a function that handles the value associated
// with a path in a Map. Note that only the value is passed in
// as an argument since the path can be stored inside the value
// if needed.
type VisitorFunc func(v interface{}) error

// Visit calls a function fn for every value in the Map
// that is registered with a match of a path p. In the
// general case, time complexity is linear with respect
// to the length of p but it can be as bad as O(2^len(p))
// if there are a lot of paths with wildcards registered.
func (m *Map) Visit(p key.Path, fn VisitorFunc) error {
	for i, element := range p {
		if m.wildcard != nil {
			if err := m.wildcard.Visit(p[i+1:], fn); err != nil {
				return err
			}
		}
		next, ok := m.children[element]
		if !ok {
			return nil
		}
		m = next
	}
	if !m.ok {
		return nil
	}
	return fn(m.val)
}

// VisitPrefixes calls a function fn for every value in the
// Map that is registered with a prefix of a path p.
func (m *Map) VisitPrefixes(p key.Path, fn VisitorFunc) error {
	for i, element := range p {
		if m.ok {
			if err := fn(m.val); err != nil {
				return err
			}
		}
		if m.wildcard != nil {
			if err := m.wildcard.VisitPrefixes(p[i+1:], fn); err != nil {
				return err
			}
		}
		next, ok := m.children[element]
		if !ok {
			return nil
		}
		m = next
	}
	if !m.ok {
		return nil
	}
	return fn(m.val)
}

// VisitPrefixed calls fn for every value in the map that is
// registerd with a path that is prefixed by p. This method
// can be used to visit every registered path if p is the
// empty path (or root path) which prefixes all paths.
func (m *Map) VisitPrefixed(p key.Path, fn VisitorFunc) error {
	for i, element := range p {
		if m.wildcard != nil {
			if err := m.wildcard.VisitPrefixed(p[i+1:], fn); err != nil {
				return err
			}
		}
		next, ok := m.children[element]
		if !ok {
			return nil
		}
		m = next
	}
	return m.visitSubtree(fn)
}

func (m *Map) visitSubtree(fn VisitorFunc) error {
	if m.ok {
		if err := fn(m.val); err != nil {
			return err
		}
	}
	if m.wildcard != nil {
		if err := m.wildcard.visitSubtree(fn); err != nil {
			return err
		}
	}
	for _, next := range m.children {
		if err := next.visitSubtree(fn); err != nil {
			return err
		}
	}
	return nil
}

// IsEmpty returns true if no paths have been registered, false otherwise.
func (m *Map) IsEmpty() bool {
	return m.wildcard == nil && len(m.children) == 0 && !m.ok
}

// Get returns the value registered with an exact match of a
// path p. If there is no exact match for p, Get returns nil
// and false. If p has an exact match and it is set to true,
// Get returns nil and true.
func (m *Map) Get(p key.Path) (interface{}, bool) {
	for _, element := range p {
		if element.Equal(Wildcard) {
			if m.wildcard == nil {
				return nil, false
			}
			m = m.wildcard
			continue
		}
		next, ok := m.children[element]
		if !ok {
			return nil, false
		}
		m = next
	}
	return m.val, m.ok
}

// Set registers a path p with a value. If the path was already
// registered with a value it returns false and true otherwise.
func (m *Map) Set(p key.Path, v interface{}) bool {
	for _, element := range p {
		if element.Equal(Wildcard) {
			if m.wildcard == nil {
				m.wildcard = &Map{}
			}
			m = m.wildcard
			continue
		}
		if m.children == nil {
			m.children = map[key.Key]*Map{}
		}
		next, ok := m.children[element]
		if !ok {
			next = &Map{}
			m.children[element] = next
		}
		m = next
	}
	set := !m.ok
	m.val, m.ok = v, true
	return set
}

// Delete unregisters the value registered with a path. It
// returns true if a value was deleted and false otherwise.
func (m *Map) Delete(p key.Path) bool {
	maps := make([]*Map, len(p)+1)
	for i, element := range p {
		maps[i] = m
		if element.Equal(Wildcard) {
			if m.wildcard == nil {
				return false
			}
			m = m.wildcard
			continue
		}
		next, ok := m.children[element]
		if !ok {
			return false
		}
		m = next
	}
	deleted := m.ok
	m.val, m.ok = nil, false
	maps[len(p)] = m

	// Remove any empty maps.
	for i := len(p); i > 0; i-- {
		m = maps[i]
		if m.ok || m.wildcard != nil || len(m.children) > 0 {
			break
		}
		parent := maps[i-1]
		element := p[i-1]
		if element.Equal(Wildcard) {
			parent.wildcard = nil
		} else {
			delete(parent.children, element)
		}
	}
	return deleted
}

func (m *Map) String() string {
	var b strings.Builder
	m.write(&b, "")
	return b.String()
}

func (m *Map) write(b *strings.Builder, indent string) {
	if m.ok {
		b.WriteString(indent)
		fmt.Fprintf(b, "Val: %v", m.val)
		b.WriteString("\n")
	}
	if m.wildcard != nil {
		b.WriteString(indent)
		fmt.Fprintf(b, "Child %q:\n", Wildcard)
		m.wildcard.write(b, indent+"  ")
	}
	children := make([]key.Key, 0, len(m.children))
	for key := range m.children {
		children = append(children, key)
	}
	sort.Slice(children, func(i, j int) bool {
		return children[i].String() < children[j].String()
	})

	for _, key := range children {
		child := m.children[key]
		b.WriteString(indent)
		fmt.Fprintf(b, "Child %q:\n", key.String())
		child.write(b, indent+"  ")
	}
}
