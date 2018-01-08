package communication

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"io"
	"sync"
	"unicode"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/pkg/errors"
	"github.com/shiftdevices/godbb/util/errp"
)

const (
	usbReportSize = 64
	hwwCID        = 0xff000000
	// initial frame identifier
	u2fHIDTypeInit = 0x80
	// first vendor defined command
	u2fHIDVendorFirst = u2fHIDTypeInit | 0x40
	hwwCMD            = u2fHIDVendorFirst | 0x01
)

// ReadWriteCloser is the same as io.ReadWriteCloser, but the Close() function not returning an
// error.
// Communication encodes JSON messages to/from a bitbox. The serialized messages are sent/received
// as USB packets, following the ISO 7816-4 standard.
type Communication struct {
	device io.ReadWriteCloser
	mutex  sync.Mutex
}

// NewCommunication creates a new Communication.
func NewCommunication(device io.ReadWriteCloser) *Communication {
	return &Communication{
		device: device,
		mutex:  sync.Mutex{},
	}
}

// Close closes the underlying device.
func (communication *Communication) Close() {
	if err := communication.device.Close(); err != nil {
		panic(err)
	}
}

func (communication *Communication) sendFrame(msg string) error {
	dataLen := len(msg)
	if dataLen == 0 {
		return nil
	}
	send := func(header []byte, readFrom *bytes.Buffer) error {
		buf := new(bytes.Buffer)
		buf.Write(header)
		buf.Write(readFrom.Next(usbReportSize - buf.Len()))
		for buf.Len() < usbReportSize {
			buf.WriteByte(0xee)
		}
		_, err := communication.device.Write(buf.Bytes())
		return errors.WithStack(err)
	}
	readBuffer := bytes.NewBuffer([]byte(msg))
	// init frame
	header := new(bytes.Buffer)
	if err := binary.Write(header, binary.BigEndian, uint32(hwwCID)); err != nil {
		return err
	}
	if err := binary.Write(header, binary.BigEndian, uint8(hwwCMD)); err != nil {
		return err
	}
	if err := binary.Write(header, binary.BigEndian, uint16(dataLen&0xFFFF)); err != nil {
		return err
	}
	if err := send(header.Bytes(), readBuffer); err != nil {
		return err
	}
	for seq := 0; readBuffer.Len() > 0; seq++ {
		// cont frame
		header = new(bytes.Buffer)
		if err := binary.Write(header, binary.BigEndian, uint32(hwwCID)); err != nil {
			return err
		}
		if err := binary.Write(header, binary.BigEndian, uint8(seq)); err != nil {
			return err
		}
		if err := send(header.Bytes(), readBuffer); err != nil {
			return err
		}
	}
	return nil
}

func (communication *Communication) readFrame() ([]byte, error) {
	read := make([]byte, usbReportSize)
	readLen, err := communication.device.Read(read)
	if err != nil {
		return nil, errors.WithStack(err)
	}
	if readLen < 7 {
		return nil, errors.New("expected minimum read length of 7")
	}
	if read[0] != 0xff || read[1] != 0 || read[2] != 0 || read[3] != 0 {
		return nil, errors.New("USB command ID mismatch")
	}
	if read[4] != hwwCMD {
		return nil, errp.Newf("USB command frame mismatch (%d, expected %d)", read[4], hwwCMD)
	}
	data := new(bytes.Buffer)
	dataLen := int(read[5])*256 + int(read[6])
	data.Write(read[7:readLen])
	idx := len(read) - 7
	for idx < dataLen {
		readLen, err = communication.device.Read(read)
		if err != nil {
			return nil, errors.WithStack(err)
		}
		if readLen < 5 {
			return nil, errors.New("expected minimum read length of 7")
		}
		data.Write(read[5:readLen])
		idx += readLen - 5
	}
	return data.Bytes(), nil
}

// SendPlain sends an unecrypted message. The response is json-deserialized into a map.
func (communication *Communication) SendPlain(msg string) (map[string]interface{}, error) {
	communication.mutex.Lock()
	defer communication.mutex.Unlock()
	if err := communication.sendFrame(msg); err != nil {
		return nil, err
	}
	reply, err := communication.readFrame()
	if err != nil {
		return nil, err
	}
	reply = bytes.TrimRightFunc(reply, func(r rune) bool { return unicode.IsSpace(r) || r == 0 })
	jsonResult := map[string]interface{}{}
	if err := json.Unmarshal(reply, &jsonResult); err != nil {
		return nil, errors.WithStack(err)
	}
	// TODO: return DBBErr as in SendEncrypt
	return jsonResult, nil
}

// DBBErr wraps an error by the bitbox.
type DBBErr struct {
	message string
	Code    float64
}

// Error implements the error interface.
func (d DBBErr) Error() string {
	return d.message
}

// SendEncrypt sends an encrypted message. The resposne is json-deserialized into a map. If the
// response contains an error field, it is returned as a DBBErr.
func (communication *Communication) SendEncrypt(msg, password string) (map[string]interface{}, error) {
	secret := chainhash.DoubleHashB([]byte(password))
	cipherText, err := encrypt(secret, []byte(msg))
	if err != nil {
		return nil, err
	}
	jsonResult, err := communication.SendPlain(cipherText)
	if err != nil {
		return nil, err
	}
	if cipherText, ok := jsonResult["ciphertext"].(string); ok {
		plainText, err := decrypt(secret, cipherText)
		if err != nil {
			return nil, err
		}
		jsonResult = map[string]interface{}{}
		if err := json.Unmarshal(plainText, &jsonResult); err != nil {
			return nil, errors.WithStack(err)
		}
	}
	if errMap, ok := jsonResult["error"].(map[string]interface{}); ok {
		errMsg, ok := errMap["message"].(string)
		if !ok {
			return nil, errors.New("unexpected reply")
		}
		errCode, ok := errMap["code"].(float64)
		if !ok {
			return nil, errors.New("unexpected reply")
		}
		return nil, &DBBErr{message: errMsg, Code: errCode}
	}
	return jsonResult, nil
}
