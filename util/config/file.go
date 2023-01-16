// Copyright 2018 Shift Devices AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// File models a config file in the application's directory.
// Callers can use AppDir function to obtain the default app config dir.
type File struct {
	dir  string
	name string
}

// NewFile creates a new config file with the given name in a directory dir.
func NewFile(dir, name string) *File {
	return &File{dir: dir, name: name}
}

// Path returns the absolute path to the config file.
func (file *File) Path() string {
	return filepath.Join(file.dir, file.name)
}

// Exists checks whether the file exists with suitable permissions as a file and not as a directory.
func (file *File) Exists() bool {
	info, err := os.Stat(file.Path())
	return err == nil && !info.IsDir()
}

// Remove removes the file.
func (file *File) Remove() error {
	return os.Remove(file.Path())
}

// read reads the config file and returns its data (or an error if the config file does not exist).
func (file *File) read() ([]byte, error) {
	return os.ReadFile(file.Path())
}

// ReadJSON reads the config file as JSON to the given object. Make sure the config file exists!
func (file *File) ReadJSON(object interface{}) error {
	data, err := file.read()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, object)
}

// write writes the given data to the config file (and creates parent directories if necessary).
func (file *File) write(data []byte) error {
	if err := os.MkdirAll(file.dir, 0700); err != nil {
		return err
	}
	return os.WriteFile(file.Path(), data, 0600)
}

// WriteJSON writes the given object as JSON to the config file.
func (file *File) WriteJSON(object interface{}) error {
	data, err := json.Marshal(object)
	if err != nil {
		return err
	}
	return file.write(data)
}
