package breez_sdk

/*
#cgo LDFLAGS: -lbreez_sdk_bindings
#cgo darwin,amd64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/darwin-amd64 -L${SRCDIR}/lib/darwin-amd64
#cgo darwin,arm64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/darwin-aarch64 -L${SRCDIR}/lib/darwin-aarch64
#cgo linux,amd64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/linux-amd64 -L${SRCDIR}/lib/linux-amd64
#cgo linux,arm64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/linux-aarch64 -L${SRCDIR}/lib/linux-aarch64
#cgo windows,amd64 LDFLAGS: -Wl,-rpath,${SRCDIR}/lib/windows-amd64 -L${SRCDIR}/lib/windows-amd64
*/
import "C"

// See https://github.com/golang/go/issues/26366.
import (
	_ "github.com/breez/breez-sdk-go/breez_sdk/lib"
)
