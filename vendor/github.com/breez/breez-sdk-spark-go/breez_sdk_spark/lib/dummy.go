// See https://github.com/golang/go/issues/26366.
package lib

import (
	_ "github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/android-386"
	_ "github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/android-aarch"
	_ "github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/android-aarch64"
	_ "github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/android-amd64"
	_ "github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/darwin-aarch64"
	_ "github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/darwin-amd64"
	_ "github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/linux-aarch64"
	_ "github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/linux-amd64"
	_ "github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib/windows-amd64"
)
