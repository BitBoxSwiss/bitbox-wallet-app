// Copyright 2018-2019 Shift Cryptosecurity AG
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

// Package u2fhid implements the U2F HID message framing protocol.
package u2fhid

import (
	"bytes"
	"encoding/binary"
	"io"
	"sync"

	"github.com/digitalbitbox/bitbox02-api-go/util/errp"
)

const (
	writeReportSize = 64
	readReportSize  = 64
)

const (
	// CID - channel identifier.
	cid uint32 = 0xff000000
)

func newBuffer() *bytes.Buffer {
	// This needs to be allocated exactly like this (not with nil or new(bytes.Buffer) etc), so that
	// the memory address of the actual bytes does not change.
	// See https://github.com/golang/go/issues/14210#issuecomment-370468469
	return bytes.NewBuffer([]byte{})
}

// Communication encodes messages as U2F HID packets. according to
// https://fidoalliance.org/specs/fido-u2f-v1.0-ps-20141009/fido-u2f-hid-protocol-ps-20141009.html#message--and-packet-structure.
type Communication struct {
	device io.ReadWriteCloser
	mutex  sync.Mutex
	cmd    byte
}

// NewCommunication creates a new Communication.
// cmd is the CMD byte which is sent and which is expected in responses.
func NewCommunication(
	device io.ReadWriteCloser,
	cmd byte) *Communication {
	return &Communication{
		device: device,
		mutex:  sync.Mutex{},
		cmd:    cmd,
	}
}

// Read reads from the underlying device.
func (communication *Communication) Read(p []byte) (n int, err error) {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	return communication.device.Read(p)
}

// Write writes to the underlying device.
func (communication *Communication) Write(p []byte) (n int, err error) {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	return communication.device.Write(p)
}

// Close closes the underlying device.
func (communication *Communication) Close() {
	if err := communication.device.Close(); err != nil {
		panic(err)
	}
}

// SendFrame sends one message in chunks, as a series of U2F HID packets.
// See https://fidoalliance.org/specs/fido-u2f-v1.0-ps-20141009/fido-u2f-hid-protocol-ps-20141009.html#message--and-packet-structure
func (communication *Communication) SendFrame(msg string) error {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	return communication.sendFrame(msg)
}

func (communication *Communication) sendFrame(msg string) error {
	dataLen := len(msg)
	if dataLen == 0 {
		return nil
	}
	send := func(header []byte, readFrom *bytes.Buffer) error {
		buf := newBuffer()
		buf.Write(header)
		buf.Write(readFrom.Next(writeReportSize - buf.Len()))
		for buf.Len() < writeReportSize {
			buf.WriteByte(0xee)
		}
		x := buf.Bytes() // needs to be in a var: https://github.com/golang/go/issues/14210#issuecomment-346402945
		_, err := communication.device.Write(x)
		return errp.WithMessage(errp.WithStack(err), "Failed to send message")
	}
	readBuffer := bytes.NewBuffer([]byte(msg))
	// init frame
	header := newBuffer()
	if err := binary.Write(header, binary.BigEndian, cid); err != nil {
		return errp.WithStack(err)
	}
	if err := binary.Write(header, binary.BigEndian, communication.cmd); err != nil {
		return errp.WithStack(err)
	}
	if err := binary.Write(header, binary.BigEndian, uint16(dataLen&0xFFFF)); err != nil {
		return errp.WithStack(err)
	}
	if err := send(header.Bytes(), readBuffer); err != nil {
		return err
	}
	for seq := 0; readBuffer.Len() > 0; seq++ {
		// cont frame
		header = newBuffer()
		if err := binary.Write(header, binary.BigEndian, cid); err != nil {
			return errp.WithStack(err)
		}
		if err := binary.Write(header, binary.BigEndian, uint8(seq)); err != nil {
			return errp.WithStack(err)
		}
		if err := send(header.Bytes(), readBuffer); err != nil {
			return err
		}
	}
	return nil
}

// ReadFrame reads U2F HID message from a series of packets.
func (communication *Communication) ReadFrame() ([]byte, error) {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	return communication.readFrame()
}

func (communication *Communication) readFrame() ([]byte, error) {
	read := make([]byte, readReportSize)
	readLen, err := communication.device.Read(read)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	if readLen < 7 {
		return nil, errp.New("expected minimum read length of 7")
	}
	replyCid := binary.BigEndian.Uint32(read[:4])
	if replyCid != cid {
		return nil, errp.Newf("USB command ID mismatch, %v != %v", cid, replyCid)
	}
	if read[4] != communication.cmd {
		return nil, errp.Newf("USB command frame mismatch (%d, expected %d)", read[4], communication.cmd)
	}
	data := newBuffer()
	dataLen := int(read[5])*256 + int(read[6])
	data.Write(read[7:readLen])
	idx := len(read) - 7
	for idx < dataLen {
		readLen, err = communication.device.Read(read)
		if err != nil {
			return nil, errp.WithStack(err)
		}
		if readLen < 5 {
			return nil, errp.New("expected minimum read length of 7")
		}
		data.Write(read[5:readLen])
		idx += readLen - 5
	}
	return data.Bytes()[:dataLen], nil
}

// Query sends a request and waits for the response. Blocking.
func (communication *Communication) Query(request []byte) ([]byte, error) {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	if err := communication.sendFrame(string(request)); err != nil {
		return nil, err
	}
	return communication.readFrame()
}
