package test

import (
	"io/ioutil"
	"os"
)

// TstTempFile gets the filename for creating a temporary file.
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

// TstTempDir creates a temporary dir and returns its path.
func TstTempDir(name string) string {
	f, err := ioutil.TempDir("", name)
	if err != nil {
		panic(err)
	}
	return f
}
