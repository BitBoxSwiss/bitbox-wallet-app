//go:build linux || windows || darwin

package breeztest

import (
	"encoding/hex"
	"log"

	"github.com/breez/breez-sdk-go/breez_sdk"
)

func init() {
	// Breez SDK test call. Remove this file and breeztest_disabled.go once working on all platforms
	// and the SDK is in use, so `go mod tidy` does not remove it.
	seed, err := breez_sdk.MnemonicToSeed("cruise clever syrup coil cute execute laundry general cover prevent law sheriff")
	if err != nil {
		panic(err)
	}
	log.Printf("BREEZ TEST API CALL: Seed: %v\n", hex.EncodeToString(seed))
}
