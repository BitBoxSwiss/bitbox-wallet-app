package util

import (
	"strconv"
	"strings"

	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/shiftdevices/godbb/util/errp"
)

// ParseOutPoint parses <txID>:<index> into an outpoint.
func ParseOutPoint(outPointBytes []byte) (*wire.OutPoint, error) {
	split := strings.SplitN(string(outPointBytes), ":", 2)
	if len(split) != 2 {
		return nil, errp.Newf("wrong outPoint format %s", string(outPointBytes))
	}
	txHash, err := chainhash.NewHashFromStr(split[0])
	if err != nil {
		return nil, errp.WithStack(err)
	}
	index, err := strconv.ParseInt(split[1], 10, 32)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	return wire.NewOutPoint(txHash, uint32(index)), nil
}
