package breez_sdk_spark

/*
#cgo !ios LDFLAGS: -lbreez_sdk_spark_bindings
#cgo android,amd64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/android-amd64 -L${SRCDIR}/lib/android-amd64
#cgo android,arm64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/android-aarch64 -L${SRCDIR}/lib/android-aarch64
#cgo android,arm LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/android-aarch -L${SRCDIR}/lib/android-aarch
#cgo android,386 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/android-386 -L${SRCDIR}/lib/android-386
#cgo darwin,amd64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/darwin-amd64 -L${SRCDIR}/lib/darwin-amd64
#cgo darwin,arm64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/darwin-aarch64 -L${SRCDIR}/lib/darwin-aarch64
#cgo ios LDFLAGS: -framework breez_sdk_sparkFFI
#cgo linux,amd64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/linux-amd64 -L${SRCDIR}/lib/linux-amd64
#cgo linux,arm64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/linux-aarch64 -L${SRCDIR}/lib/linux-aarch64
#cgo windows,amd64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/windows-amd64 -L${SRCDIR}/lib/windows-amd64
*/
import "C"

// See https://github.com/golang/go/issues/26366.
import (
	_ "github.com/breez/breez-sdk-spark-go/breez_sdk_spark/lib"
)
