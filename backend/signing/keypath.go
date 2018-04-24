package signing

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/btcsuite/btcutil/hdkeychain"
	"github.com/shiftdevices/godbb/util/errp"
)

const hardenedKeySymbol = "'"

type keyNode struct {
	index    uint32
	hardened bool
}

func (node keyNode) Encode() string {
	suffix := ""
	if node.hardened {
		suffix = hardenedKeySymbol
	}
	return fmt.Sprint(node.index, suffix)
}

type keypath []keyNode

func newKeypath(input string) (keypath, error) {
	nodes := strings.Split(input, "/")
	path := make(keypath, 0, len(nodes))
	for _, node := range nodes {
		node = strings.TrimSpace(node)
		if len(node) == 0 {
			continue
		}
		hardened := strings.HasSuffix(node, hardenedKeySymbol)
		if hardened {
			node = strings.TrimSpace(node[:len(node)-len(hardenedKeySymbol)])
		}
		index, err := strconv.Atoi(node)
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

func (path keypath) Encode() string {
	nodes := make([]string, len(path))
	for index, node := range path {
		nodes[index] = node.Encode()
	}
	return strings.Join(nodes, "/")
}

// Derive derives the extended pubkey at the path starting at the given extendedKey.
func (path keypath) Derive(extendedKey *hdkeychain.ExtendedKey) (*hdkeychain.ExtendedKey, error) {
	for _, node := range path {
		offset := uint32(0)
		if node.hardened {
			offset = hdkeychain.HardenedKeyStart
		}
		var err error
		extendedKey, err = extendedKey.Child(offset + uint32(node.index))
		if err != nil {
			return nil, err
		}
	}
	return extendedKey, nil
}

// RelativeKeypath models a relative keypath according to BIP32.
type RelativeKeypath keypath

// NewRelativeKeypath creates a new RelativeKeyPath from a string like `1/2'/3`.
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

// Encode serializes the keypath.
func (relativeKeypath RelativeKeypath) Encode() string {
	return keypath(relativeKeypath).Encode()
}

// NonHardened returns whether the keypath contains a hardened derivation.
func (relativeKeypath RelativeKeypath) NonHardened() bool {
	for _, node := range relativeKeypath {
		if node.hardened {
			return false
		}
	}
	return true
}

// Derive derives the extended pubkey at the path starting at the given extendedKey.
func (relativeKeypath RelativeKeypath) Derive(
	extendedKey *hdkeychain.ExtendedKey,
) (*hdkeychain.ExtendedKey, error) {
	return keypath(relativeKeypath).Derive(extendedKey)
}

// AbsoluteKeypath models an absolute keypath according to BIP32.
type AbsoluteKeypath keypath

// NewEmptyAbsoluteKeypath creates a new AbsoluteKeypath.
func NewEmptyAbsoluteKeypath() AbsoluteKeypath {
	return AbsoluteKeypath{}
}

// NewAbsoluteKeypath creates a new AbsoluteKeypath from a string like `m/44'/1'`.
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

// Encode serializes the keypath.
func (absoluteKeypath AbsoluteKeypath) Encode() string {
	return "m/" + keypath(absoluteKeypath).Encode()
}

// Child appends a part to the keypath.
func (absoluteKeypath AbsoluteKeypath) Child(index uint32, hardened bool) AbsoluteKeypath {
	return append(absoluteKeypath, keyNode{index, hardened})
}

// Append appends a relative keypath.
func (absoluteKeypath AbsoluteKeypath) Append(suffix RelativeKeypath) AbsoluteKeypath {
	return append(absoluteKeypath, suffix...)
}

// Derive derives the extended pubkey at the path starting at the given extendedKey.
func (absoluteKeypath AbsoluteKeypath) Derive(
	extendedKey *hdkeychain.ExtendedKey,
) (*hdkeychain.ExtendedKey, error) {
	return keypath(absoluteKeypath).Derive(extendedKey)
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
