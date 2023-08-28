// See https://github.com/golang/go/issues/26366.
package lib

import (
	_ "github.com/breez/breez-sdk-go/breez_sdk/lib/darwin-aarch64"
	_ "github.com/breez/breez-sdk-go/breez_sdk/lib/darwin-amd64"
	_ "github.com/breez/breez-sdk-go/breez_sdk/lib/linux-aarch64"
	_ "github.com/breez/breez-sdk-go/breez_sdk/lib/linux-amd64"
	_ "github.com/breez/breez-sdk-go/breez_sdk/lib/windows-amd64"
)
