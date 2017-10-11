package binweb

// The following go:generate command compiles the static web assets into a Go package, so that they
// are built into the binary. The WEBASSETS env var must be set and point to the folder containing
// the web assets.

//go:generate echo $WEBASSETS
//go:generate go-bindata -pkg $GOPACKAGE -o assets.go -prefix $WEBASSETS $WEBASSETS
