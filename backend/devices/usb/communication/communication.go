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

package communication

import (
	"bytes"
	"encoding/binary"
	"io"
	"sync"

	"github.com/digitalbitbox/bitbox-wallet-app/util/errp"
	"github.com/digitalbitbox/bitbox-wallet-app/util/logging"
	"github.com/sirupsen/logrus"
)

const (
	usbWriteReportSize = 64
	usbReadReportSize  = 64
)

const (
	hwwCID = 0xff000000
)

func newBuffer() *bytes.Buffer {
	// This needs to be allocated exactly like this (not with nil or new(bytes.Buffer) etc), so that
	// the memory address of the actual bytes does not change.
	// See https://github.com/golang/go/issues/14210#issuecomment-370468469
	return bytes.NewBuffer([]byte{})
}

// Communication encodes JSON messages to/from a bitbox. The serialized messages are sent/received
// as USB packets, following the ISO 7816-4 standard.
type Communication struct {
	device io.ReadWriteCloser
	mutex  sync.Mutex
	log    *logrus.Entry
	usbCMD byte
}

// NewCommunication creates a new Communication.
func NewCommunication(
	device io.ReadWriteCloser,
	usbCMD byte) *Communication {
	return &Communication{
		device: device,
		mutex:  sync.Mutex{},
		log:    logging.Get().WithGroup("usb"),
		usbCMD: usbCMD,
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
		communication.log.WithError(err).Panic(err)
		panic(err)
	}
}

// SendFrame sends one usb message.
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
		buf.Write(readFrom.Next(usbWriteReportSize - buf.Len()))
		for buf.Len() < usbWriteReportSize {
			buf.WriteByte(0xee)
		}
		x := buf.Bytes() // needs to be in a var: https://github.com/golang/go/issues/14210#issuecomment-346402945
		_, err := communication.device.Write(x)
		return errp.WithMessage(errp.WithStack(err), "Failed to send message")
	}
	readBuffer := bytes.NewBuffer([]byte(msg))
	// init frame
	header := newBuffer()
	if err := binary.Write(header, binary.BigEndian, uint32(hwwCID)); err != nil {
		return errp.WithStack(err)
	}
	if err := binary.Write(header, binary.BigEndian, communication.usbCMD); err != nil {
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
		if err := binary.Write(header, binary.BigEndian, uint32(hwwCID)); err != nil {
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

// ReadFrame reads one usb message.
func (communication *Communication) ReadFrame() ([]byte, error) {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	return communication.readFrame()
}

func (communication *Communication) readFrame() ([]byte, error) {
	read := make([]byte, usbReadReportSize)
	readLen, err := communication.device.Read(read)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	if readLen < 7 {
		return nil, errp.New("expected minimum read length of 7")
	}
	if read[0] != 0xff || read[1] != 0 || read[2] != 0 || read[3] != 0 {
		return nil, errp.Newf("USB command ID mismatch %d %d %d %d", read[0], read[1], read[2], read[3])
	}
	if read[4] != communication.usbCMD {
		return nil, errp.Newf("USB command frame mismatch (%d, expected %d)", read[4], communication.usbCMD)
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

// Query sends a request and returns for the response. Blocking.
func (communication *Communication) Query(request []byte) ([]byte, error) {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	if err := communication.sendFrame(string(request)); err != nil {
		return nil, err
	}
	return communication.readFrame()
}
