package semver_test

import (
	"testing"

	"github.com/shiftdevices/godbb/util/semver"
	"github.com/stretchr/testify/assert"
)

func TestNewSemVer(t *testing.T) {
	if version, err := semver.NewSemVerFromString("3.2.4"); assert.Nil(t, err) {
		assert.Equal(t, semver.NewSemVer(3, 2, 4), version)
	}

	var err error

	_, err = semver.NewSemVerFromString("3.2")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.2.")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.2.A")
	assert.Error(t, err)

	_, err = semver.NewSemVerFromString("3.2.4-")
	assert.Error(t, err)
}

func TestAtLeast(t *testing.T) {
	fromVersion := semver.NewSemVer(3, 2, 4)

	assert.True(t, semver.NewSemVer(3, 2, 4).AtLeast(fromVersion))
	assert.False(t, semver.NewSemVer(3, 2, 3).AtLeast(fromVersion))
}

func TestBetween(t *testing.T) {
	fromVersion := semver.NewSemVer(3, 2, 4)
	toVersion := semver.NewSemVer(4, 3, 1)

	assert.True(t, semver.NewSemVer(3, 2, 4).Between(fromVersion, toVersion))
	assert.True(t, semver.NewSemVer(4, 2, 3).Between(fromVersion, toVersion))
	assert.True(t, semver.NewSemVer(4, 3, 0).Between(fromVersion, toVersion))
	assert.False(t, semver.NewSemVer(3, 2, 1).Between(fromVersion, toVersion))
	assert.False(t, semver.NewSemVer(4, 3, 1).Between(fromVersion, toVersion))
}

func TestString(t *testing.T) {
	assert.Equal(t, "3.2.4", semver.NewSemVer(3, 2, 4).String())
}
