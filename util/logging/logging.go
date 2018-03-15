package logging

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

// LogConfig holds configuration parameters passed in the YAML config file
type LogConfig struct {
	Output    string `yaml:"output"`
	Threshold string `yaml:"base-threshold"`
}

// Logger embedds and extends the Logrus Logger with a trace group specific
// threshold levels
type Logger struct {
	logrus.Logger
	logConfig *LogConfig
}

// Log stores the setup logger or nil, if the logger was not set up yet.
var Log = setupFromConfig("config/logging/log.yaml")

func parseThresholdLevel(value string) (logrus.Level, error) {
	switch value {
	case "DEBUG":
		return logrus.DebugLevel, nil
	case "INFO":
		return logrus.InfoLevel, nil
	case "WARNING":
		return logrus.WarnLevel, nil
	case "ERROR":
		return logrus.ErrorLevel, nil
	case "FATAL":
		return logrus.FatalLevel, nil
	case "PANIC":
		return logrus.PanicLevel, nil
	}
	return 0, fmt.Errorf("threshold %s is unknown", value)
}

func setupFromConfig(configFile string) *Logger {
	dir, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	_, err = os.Stat(configFile)
	var logconfig []byte
	if err != nil && os.IsNotExist(err) {
		logconfig = []byte(`
output: "STDERR"
base-threshold: DEBUG
`)
	} else if err != nil {
		panic(fmt.Sprintf("Failed to open config file: %s", err))
	} else {
		fmt.Printf("Log config: %s/%s \n", dir, configFile)
		logconfig, err = ioutil.ReadFile(configFile)
		if err != nil {
			panic(fmt.Sprintf("Couldn't read logging config file: %s", err))
		}
	}
	log, err := setup(logconfig)
	if err != nil {
		panic(fmt.Sprintf("Couldn't set up logging: %s", err))
	}
	return log
}

// Setup sets up the logger from information of a given config
func setup(config []byte) (*Logger, error) {
	var log = Logger{}
	log.logConfig = &LogConfig{}
	log.Logger.Formatter = &logrus.TextFormatter{}
	log.Logger.Hooks = make(logrus.LevelHooks)
	log.Logger.AddHook(NewHook([]logrus.Level{logrus.PanicLevel, logrus.FatalLevel, logrus.ErrorLevel}))
	err := yaml.UnmarshalStrict(config, log.logConfig)
	if err != nil {
		return nil, err
	}
	if log.logConfig.Output == "STDOUT" {
		log.Out = os.Stdout
	} else if log.logConfig.Output == "STDERR" {
		log.Out = os.Stderr
	} else {
		directory := filepath.Dir(log.logConfig.Output)
		err = os.MkdirAll(directory, os.ModeDir|os.ModePerm)
		if err != nil {
			return nil, err
		}
		var file *os.File
		file, err = os.OpenFile(log.logConfig.Output, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0666)
		if err != nil {
			return nil, err
		}
		log.Out = file
		fmt.Printf("Logging into: %s\n", log.logConfig.Output)
	}
	log.Level, err = parseThresholdLevel(log.logConfig.Threshold)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// BaseThreshold returns the base threshold
func (logger *Logger) BaseThreshold() string {
	return logger.logConfig.Threshold
}

// Output returns the log file into which logs are written
func (logger *Logger) Output() string {
	return logger.logConfig.Output
}

// WithGroup sets a trace group for the log entry
func (logger *Logger) WithGroup(group string) *logrus.Entry {
	return logger.WithField("group", group)
}
