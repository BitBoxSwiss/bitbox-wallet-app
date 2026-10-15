// SPDX-License-Identifier: Apache-2.0

package main

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWebdevLightningEncryptionKeys(t *testing.T) {
	const (
		accountCode   = "v0-deadbeef-ln-0"
		encryptionKey = "test-encryption-key"
	)
	configDir := t.TempDir()
	environment := newWebdevEnvironment(configDir)
	require.True(t, environment.CanEncryptLightningMnemonic())
	require.NoError(t, environment.StoreLightningEncryptionKey(accountCode, encryptionKey))

	restartedEnvironment := newWebdevEnvironment(configDir)
	key, err := restartedEnvironment.LoadLightningEncryptionKey(accountCode)
	require.NoError(t, err)
	require.Equal(t, encryptionKey, key)

	require.NoError(t, restartedEnvironment.DeleteLightningEncryptionKey(accountCode))
	_, err = environment.LoadLightningEncryptionKey(accountCode)
	require.Error(t, err)
}

func TestNormalizeAppleSeparator(t *testing.T) {
	for _, tc := range []struct {
		name string
		in   string
	}{
		{
			name: "double backslash lowercase",
			in:   `\\U202f`,
		},
		{
			name: "double backslash uppercase",
			in:   `\\U202F`,
		},
		{
			name: "single backslash lowercase",
			in:   `\U202f`,
		},
		{
			name: "single backslash uppercase",
			in:   `\U202F`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := normalizeAppleSeparator(tc.in); got != "\u202f" {
				t.Fatalf("got %q, want %q", got, "\u202f")
			}
		})
	}
}
