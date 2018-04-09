package test

import (
	"io/ioutil"
	"os"
)

// TstTempFile creates a temporary file and returns its filename.
func TstTempFile(name string) string {
	f, err := ioutil.TempFile("", name)
	if err != nil {
		panic(err)
	}
	if err := f.Close(); err != nil {
		panic(err)
	}
	if err := os.Remove(f.Name()); err != nil {
		panic(err)
	}
	return f.Name()
}
