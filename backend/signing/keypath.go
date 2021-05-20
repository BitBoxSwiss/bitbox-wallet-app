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

package signing

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
)

const (
	hardenedKeySymbol = "'"

	// Hardened denotes a hardened key derivation.
	Hardened = true

	// NonHardened denotes a non-hardened key derivation.
	NonHardened = false
)

// This type is called node because keyNode is marked by the linter as a misspelling.
type keyNode struct {
	index    uint32
	hardened bool
}

func (node keyNode) encode() string {
	suffix := ""
	if node.hardened {
		suffix = hardenedKeySymbol
	}
	return fmt.Sprint(node.index, suffix)
}

type keypath []keyNode

func newKeypath(input string) (keypath, error) {
	splits := strings.Split(input, "/")
	path := make(keypath, 0, len(splits))
	for _, split := range splits {
		split = strings.TrimSpace(split)
		if len(split) == 0 {
			continue
		}
		hardened := strings.HasSuffix(split, hardenedKeySymbol)
		if hardened {
			split = strings.TrimSpace(split[:len(split)-len(hardenedKeySymbol)])
		}
		index, err := strconv.Atoi(split)
		if err != nil {
			return nil, errp.Wrap(err, "A path node is not a number.")
		}
		if index < 0 {
			return nil, errp.New("A path index may not be negative.")
		}
		path = append(path, keyNode{uint32(index), hardened})
	}
	return path, nil
}

func (path keypath) encode() string {
	nodes := make([]string, len(path))
	for index, node := range path {
		nodes[index] = node.encode()
	}
	return strings.Join(nodes, "/")
}

func (path keypath) toUInt32() []uint32 {
	result := make([]uint32, len(path))
	for index, node := range path {
		offset := uint32(0)
		if node.hardened {
			offset = hdkeychain.HardenedKeyStart
		}
		result[index] = offset + node.index
	}
	return result
}

func (path keypath) derive(extendedKey *hdkeychain.ExtendedKey) (*hdkeychain.ExtendedKey, error) {
	for _, child := range path.toUInt32() {
		var err error
		extendedKey, err = extendedKey.Child(child)
		if err != nil {
			return nil, err
		}
	}
	return extendedKey, nil
}

// RelativeKeypath models a relative keypath according to BIP32.
type RelativeKeypath keypath

// NewEmptyRelativeKeypath creates a new empty relative keypath.
func NewEmptyRelativeKeypath() RelativeKeypath {
	return RelativeKeypath{}
}

// NewRelativeKeypath creates a new relative keypath from a string like `1/2'/3`.
func NewRelativeKeypath(input string) (RelativeKeypath, error) {
	input = strings.TrimSpace(input)
	if strings.HasPrefix(input, "m") {
		return nil, errp.New("A relative keypath may not start with 'm'.")
	}
	path, err := newKeypath(input)
	if err != nil {
		return nil, err
	}
	return RelativeKeypath(path), nil
}

// Encode encodes the relative keypath as a string.
func (relativeKeypath RelativeKeypath) Encode() string {
	return keypath(relativeKeypath).encode()
}

// Child appends the given node to this relative keypath.
func (relativeKeypath RelativeKeypath) Child(index uint32, hardened bool) RelativeKeypath {
	newKeypath := append(RelativeKeypath{}, relativeKeypath...)
	return append(newKeypath, keyNode{index, hardened})
}

// Hardened returns whether the keypath contains a hardened derivation.
func (relativeKeypath RelativeKeypath) Hardened() bool {
	for _, node := range relativeKeypath {
		if node.hardened {
			return true
		}
	}
	return false
}

// Derive derives the extended key at this path from the given extended key.
func (relativeKeypath RelativeKeypath) Derive(
	extendedKey *hdkeychain.ExtendedKey,
) (*hdkeychain.ExtendedKey, error) {
	return keypath(relativeKeypath).derive(extendedKey)
}

// ToUInt32 returns the keypath as child numbers. Hardened children have an offset of 0x80000000.
func (relativeKeypath RelativeKeypath) ToUInt32() []uint32 {
	return keypath(relativeKeypath).toUInt32()
}

// AbsoluteKeypath models an absolute keypath according to BIP32.
type AbsoluteKeypath keypath

// NewEmptyAbsoluteKeypath creates a new empty absolute keypath.
func NewEmptyAbsoluteKeypath() AbsoluteKeypath {
	return AbsoluteKeypath{}
}

// NewAbsoluteKeypath creates a new absolute keypath from a string like `m/44'/1'`.
func NewAbsoluteKeypath(input string) (AbsoluteKeypath, error) {
	input = strings.TrimSpace(input)
	if !strings.HasPrefix(input, "m") {
		return nil, errp.New("An absolute keypath has to start with 'm'.")
	}
	input = input[strings.Index(input, "/")+1:]
	path, err := newKeypath(input)
	if err != nil {
		return nil, err
	}
	return AbsoluteKeypath(path), nil
}

// NewAbsoluteKeypathFromUint32 creates a new keypath from individual numbers.
// Hardened children have an offset of 0x80000000.
func NewAbsoluteKeypathFromUint32(elements ...uint32) AbsoluteKeypath {
	path := keypath{}
	for _, element := range elements {
		if element >= hdkeychain.HardenedKeyStart {
			path = append(path, keyNode{index: element - hdkeychain.HardenedKeyStart, hardened: true})
		} else {
			path = append(path, keyNode{index: element, hardened: false})
		}
	}
	return AbsoluteKeypath(path)
}

// Encode encodes the absolute keypath as a string.
func (absoluteKeypath AbsoluteKeypath) Encode() string {
	return "m/" + keypath(absoluteKeypath).encode()
}

// Child appends the given node to this absolute keypath.
func (absoluteKeypath AbsoluteKeypath) Child(index uint32, hardened bool) AbsoluteKeypath {
	newKeypath := append(AbsoluteKeypath{}, absoluteKeypath...)
	return append(newKeypath, keyNode{index, hardened})
}

// Append appends a relative keypath to this absolute keypath.
func (absoluteKeypath AbsoluteKeypath) Append(suffix RelativeKeypath) AbsoluteKeypath {
	newKeypath := append(AbsoluteKeypath{}, absoluteKeypath...)
	return append(newKeypath, suffix...)
}

// Derive derives the extended key at this path from the given extended key.
func (absoluteKeypath AbsoluteKeypath) Derive(
	extendedKey *hdkeychain.ExtendedKey,
) (*hdkeychain.ExtendedKey, error) {
	return keypath(absoluteKeypath).derive(extendedKey)
}

// ToUInt32 returns the keypath as child numbers. Hardened children have an offset of 0x80000000.
func (absoluteKeypath AbsoluteKeypath) ToUInt32() []uint32 {
	return keypath(absoluteKeypath).toUInt32()
}

// MarshalJSON implements json.Marshaler.
func (absoluteKeypath AbsoluteKeypath) MarshalJSON() ([]byte, error) {
	return json.Marshal(absoluteKeypath.Encode())
}

// UnmarshalJSON implements json.Unmarshaler.
func (absoluteKeypath *AbsoluteKeypath) UnmarshalJSON(bytes []byte) error {
	var input string
	if err := json.Unmarshal(bytes, &input); err != nil {
		return errp.Wrap(err, "Could not unmarshal an absolute keypath.")
	}
	var err error
	*absoluteKeypath, err = NewAbsoluteKeypath(input)
	return err
}
