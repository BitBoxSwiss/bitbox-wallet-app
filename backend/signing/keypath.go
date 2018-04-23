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

type keynode struct {
	index    uint32
	hardened bool
}

func (node keynode) Encode() string {
	suffix := ""
	if node.hardened {
		suffix = hardenedKeySymbol
	}
	return fmt.Sprint(node.index, suffix)
}

type keypath []keynode

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
		path = append(path, keynode{uint32(index), hardened})
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

func NewEmptyRelativeKeypath() RelativeKeypath {
	return make(RelativeKeypath, 0)
}

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

func (relativeKeypath RelativeKeypath) Encode() string {
	return keypath(relativeKeypath).Encode()
}

func (relativeKeypath RelativeKeypath) NonHardened() bool {
	for _, node := range relativeKeypath {
		if node.hardened {
			return false
		}
	}
	return true
}

func (relativeKeypath RelativeKeypath) Add(index uint32, hardened bool) RelativeKeypath {
	return append(relativeKeypath, keynode{index, hardened})
}

func (relativeKeypath RelativeKeypath) Derive(
	extendedKey *hdkeychain.ExtendedKey,
) (*hdkeychain.ExtendedKey, error) {
	return keypath(relativeKeypath).Derive(extendedKey)
}

// AbsoluteKeypath models an absolute keypath according to BIP32.
type AbsoluteKeypath keypath

func NewEmptyAbsoluteKeypath() AbsoluteKeypath {
	return make(AbsoluteKeypath, 0)
}

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

func (absoluteKeypath AbsoluteKeypath) Encode() string {
	return "m/" + keypath(absoluteKeypath).Encode()
}

func (absoluteKeypath AbsoluteKeypath) Add(index uint32, hardened bool) AbsoluteKeypath {
	return append(absoluteKeypath, keynode{index, hardened})
}

func (absoluteKeypath AbsoluteKeypath) Append(suffix RelativeKeypath) AbsoluteKeypath {
	return append(absoluteKeypath, suffix...)
}

func (absoluteKeypath AbsoluteKeypath) HasPrefix(prefix AbsoluteKeypath) bool {
	length := len(prefix)
	if len(absoluteKeypath) < length {
		return false
	}
	for i := 0; i < length; i++ {
		if prefix[i] != absoluteKeypath[i] {
			return false
		}
	}
	return true
}

func (absoluteKeypath AbsoluteKeypath) Without(prefix AbsoluteKeypath) (RelativeKeypath, error) {
	length := len(prefix)
	if len(absoluteKeypath) < length {
		return nil, errp.New("The prefix may not be longer than the absolute keypath.")
	}
	for i := 0; i < length; i++ {
		if prefix[i] != absoluteKeypath[i] {
			return nil, errp.New("The given keypath is not a prefix of this keypath.")
		}
	}
	return RelativeKeypath(absoluteKeypath[length:]), nil
}

func (absoluteKeypath AbsoluteKeypath) Derive(
	extendedKey *hdkeychain.ExtendedKey,
) (*hdkeychain.ExtendedKey, error) {
	return keypath(absoluteKeypath).Derive(extendedKey)
}

func (absoluteKeypath AbsoluteKeypath) MarshalJSON() ([]byte, error) {
	return json.Marshal(absoluteKeypath.Encode())
}

func (absoluteKeypath *AbsoluteKeypath) UnmarshalJSON(bytes []byte) error {
	var input string
	if err := json.Unmarshal(bytes, &input); err != nil {
		return errp.Wrap(err, "Could not unmarshal an absolute keypath.")
	}
	var err error
	*absoluteKeypath, err = NewAbsoluteKeypath(input)
	return err
}
