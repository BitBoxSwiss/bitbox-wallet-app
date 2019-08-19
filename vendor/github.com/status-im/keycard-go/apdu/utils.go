package apdu

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

type Tag []byte

var (
	ErrUnsupportedLenth80 = errors.New("length cannot be 0x80")
	ErrLengthTooBig       = errors.New("length cannot be more than 3 bytes")
)

// ErrTagNotFound is an error returned if a tag is not found in a TLV sequence.
type ErrTagNotFound struct {
	tag Tag
}

// Error implements the error interface
func (e *ErrTagNotFound) Error() string {
	return fmt.Sprintf("tag %x not found", e.tag)
}

// FindTag searches for a tag value within a TLV sequence.
func FindTag(raw []byte, tags ...Tag) ([]byte, error) {
	return findTag(raw, 0, tags...)
}

// FindTagN searches for a tag value within a TLV sequence and returns the n occurrence
func FindTagN(raw []byte, n int, tags ...Tag) ([]byte, error) {
	return findTag(raw, n, tags...)
}

func findTag(raw []byte, occurrence int, tags ...Tag) ([]byte, error) {
	if len(tags) == 0 {
		return raw, nil
	}

	target := tags[0]
	buf := bytes.NewBuffer(raw)

	var (
		tag    Tag
		length uint32
		err    error
	)

	for {
		tag, buf, err = parseTag(buf)
		switch {
		case err == io.EOF:
			return []byte{}, &ErrTagNotFound{target}
		case err != nil:
			return nil, err
		}

		length, buf, err = parseLength(buf)
		if err != nil {
			return nil, err
		}

		data := make([]byte, length)
		if length != 0 {
			_, err = buf.Read(data)
			if err != nil {
				return nil, err
			}
		}

		if bytes.Equal(tag, target) {
			// if it's the last tag in the search path, we start counting the occurrences
			if len(tags) == 1 && occurrence > 0 {
				occurrence--
				continue
			}

			if len(tags) == 1 {
				return data, nil
			}

			return findTag(data, occurrence, tags[1:]...)
		}
	}
}

func parseLength(buf *bytes.Buffer) (uint32, *bytes.Buffer, error) {
	length, err := buf.ReadByte()
	if err != nil {
		return 0, nil, err
	}

	if length == 0x80 {
		return 0, nil, ErrUnsupportedLenth80
	}

	if length > 0x80 {
		lengthSize := length - 0x80
		if lengthSize > 3 {
			return 0, nil, ErrLengthTooBig
		}

		data := make([]byte, lengthSize)
		_, err = buf.Read(data)
		if err != nil {
			return 0, nil, err
		}

		num := make([]byte, 4)
		copy(num[4-lengthSize:], data)

		return binary.BigEndian.Uint32(num), buf, nil
	}

	return uint32(length), buf, nil
}

func parseTag(buf *bytes.Buffer) (Tag, *bytes.Buffer, error) {
	tag := make(Tag, 0)
	b, err := buf.ReadByte()
	if err != nil {
		return nil, nil, err
	}

	tag = append(tag, b)
	if b&0x1F != 0x1F {
		return tag, buf, nil
	}

	for {
		b, err = buf.ReadByte()
		if err != nil {
			return nil, nil, err
		}

		tag = append(tag, b)

		if b&0x80 != 0x80 {
			return tag, buf, nil
		}
	}
}
