// Copyright (c) 2019 Arista Networks, Inc.
// Use of this source code is governed by the Apache License 2.0
// that can be found in the COPYING file.

package path_test

import (
	"fmt"
	"sort"

	"github.com/aristanetworks/goarista/path"
)

func ExampleMap_Visit() {
	var m path.Map
	m.Set(path.New("foo", "bar", "baz"), 1)
	m.Set(path.New("foo", path.Wildcard, "baz"), 2)
	m.Set(path.New(path.Wildcard, "bar", "baz"), 3)
	m.Set(path.New("foo", "bar", path.Wildcard), 4)
	m.Set(path.New(path.Wildcard, path.Wildcard, "baz"), 5)
	m.Set(path.New(path.Wildcard, "bar", path.Wildcard), 6)
	m.Set(path.New("foo", path.Wildcard, path.Wildcard), 7)
	m.Set(path.New(path.Wildcard, path.Wildcard, path.Wildcard), 8)

	p := path.New("foo", "bar", "baz")

	var nums []int
	m.Visit(p, func(v interface{}) error {
		nums = append(nums, v.(int))
		return nil
	})
	sort.Ints(nums)
	fmt.Println(nums)

	// Output: [1 2 3 4 5 6 7 8]
}

func ExampleMap_VisitPrefixes() {
	var m path.Map
	m.Set(path.New(), 1)
	m.Set(path.New("foo"), 2)
	m.Set(path.New("foo", "bar"), 3)
	m.Set(path.New("foo", "baz"), 4)
	m.Set(path.New(path.Wildcard, "bar"), 5)

	p := path.New("foo", "bar", "baz")

	var nums []int
	m.VisitPrefixes(p, func(v interface{}) error {
		nums = append(nums, v.(int))
		return nil
	})
	sort.Ints(nums)
	fmt.Println(nums)

	// Output: [1 2 3 5]
}

func ExampleMap_VisitPrefixed() {
	var m path.Map
	m.Set(path.New("foo"), 1)
	m.Set(path.New("foo", "bar"), 2)
	m.Set(path.New("foo", "bar", "baz"), 3)
	m.Set(path.New("foo", path.Wildcard), 4)

	p := path.New("foo", "bar")

	var nums []int
	m.VisitPrefixed(p, func(v interface{}) error {
		nums = append(nums, v.(int))
		return nil
	})
	sort.Ints(nums)
	fmt.Println(nums)

	// Ouput: [2 3 4]
}

func ExampleMap_Get() {
	var m path.Map
	m.Set(path.New("foo", "bar"), 1)
	m.Set(path.New("baz", "qux"), nil)

	a, ok := m.Get(path.New("foo", "bar"))
	fmt.Printf("a = %v, ok = %t\n", a, ok)
	b, ok := m.Get(path.New("foo", path.Wildcard))
	fmt.Printf("b = %v, ok = %t\n", b, ok)
	c, ok := m.Get(path.New("baz", "qux"))
	fmt.Printf("c = %v, ok = %t\n", c, ok)

	// Output:
	// a = 1, ok = true
	// b = <nil>, ok = false
	// c = <nil>, ok = true
}

func ExampleMap_Set() {
	var m path.Map
	p := path.New("foo", "bar")

	fmt.Println(m.Set(p, 0))
	fmt.Println(m.Set(p, 1))

	a, ok := m.Get(p)
	fmt.Printf("a = %v, ok = %t\n", a, ok)

	// Output:
	// true
	// false
	// a = 1, ok = true
}

func ExampleMap_Delete() {
	var m path.Map
	p := path.New("foo", "bar")

	m.Set(p, 0)

	fmt.Println(m.Delete(p))
	fmt.Println(m.Delete(p))

	// Output:
	// true
	// false
}
