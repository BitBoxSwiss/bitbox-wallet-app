package storage

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"runtime"
)

// DirectoryPath returns the absolute path to the application's directory.
func DirectoryPath() string {
	switch goos := runtime.GOOS; goos {
	case "darwin":
		return filepath.Join(os.Getenv("HOME"), "Library", "Application Support", "DBB")
	case "windows":
		return filepath.Join(os.Getenv("APPDATA"), "DBB")
	default:
		return filepath.Join(os.Getenv("HOME"), ".dbb")
	}
}

// ConfigFile models a config file in the application's directory.
type ConfigFile struct {
	name string
}

// NewConfigFile creates a new config file with the given name in the application's directory.
func NewConfigFile(name string) *ConfigFile {
	return &ConfigFile{name}
}

// Path returns the absolute path to the config file.
func (file *ConfigFile) Path() string {
	return filepath.Join(DirectoryPath(), file.name)
}

// Exists checks whether the file exists with suitable permissions as a file and not as a directory.
func (file *ConfigFile) Exists() bool {
	info, err := os.Stat(file.Path())
	if err != nil || info.IsDir() {
		return false
	}
	return true
}

// Read reads the config file and returns its data (or an error if the config file does not exist).
func (file *ConfigFile) Read() ([]byte, error) {
	return ioutil.ReadFile(file.Path())
}

// ReadJSON reads the config file as JSON to the given object. Make sure the config file exists!
func (file *ConfigFile) ReadJSON(object interface{}) error {
	data, err := file.Read()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, object)
}

// Write writes the given data to the config file (and creates parent directories if necessary).
func (file *ConfigFile) Write(data []byte) error {
	if err := os.MkdirAll(DirectoryPath(), os.ModePerm); err != nil {
		return err
	}
	return ioutil.WriteFile(file.Path(), data, 0600)
}

// WriteJSON writes the given object as JSON to the config file.
func (file *ConfigFile) WriteJSON(object interface{}) error {
	data, err := json.Marshal(object)
	if err != nil {
		return err
	}
	return file.Write(data)
}
