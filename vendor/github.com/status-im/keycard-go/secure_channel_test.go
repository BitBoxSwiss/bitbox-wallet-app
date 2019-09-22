package keycard

import (
	"errors"
	"testing"

	"github.com/status-im/keycard-go/apdu"
	"github.com/status-im/keycard-go/hexutils"
	"github.com/stretchr/testify/assert"
)

type fakeChannel struct {
	lastCmd *apdu.Command
}

func (fc *fakeChannel) Send(cmd *apdu.Command) (*apdu.Response, error) {
	fc.lastCmd = cmd
	return nil, errors.New("test error")
}

func TestSecureChannel_Send(t *testing.T) {
	c := &fakeChannel{}
	sc := &SecureChannel{
		c:      c,
		encKey: hexutils.HexToBytes("FDBCB1637597CF3F8F5E8263007D4E45F64C12D44066D4576EB1443D60AEF441"),
		macKey: hexutils.HexToBytes("2FB70219E6635EE0958AB3F7A428BA87E8CD6E6F873A5725A55F25B102D0F1F7"),
		iv:     hexutils.HexToBytes("627E64358FA9BDCDAD4442BD8006E0A5"),
		open:   true,
	}

	data := hexutils.HexToBytes("D545A5E95963B6BCED86A6AE826D34C5E06AC64A1217EFFA1415A96674A82500")

	cmd := NewCommandMutuallyAuthenticate(data)
	sc.Send(cmd)

	expectedData := "BA796BF8FAD1FD50407B87127B94F5023EF8903AE926EAD8A204F961B8A0EDAEE7CCCFE7F7F6380CE2C6F188E598E4468B7DEDD0E807C18CCBDA71A55F3E1F9A"
	assert.Equal(t, expectedData, hexutils.BytesToHex(c.lastCmd.Data))

	expectedIV := "BA796BF8FAD1FD50407B87127B94F502"
	assert.Equal(t, expectedIV, hexutils.BytesToHex(sc.iv))
}
