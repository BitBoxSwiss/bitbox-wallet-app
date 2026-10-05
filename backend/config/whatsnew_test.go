// SPDX-License-Identifier: Apache-2.0

package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWhatsNewPersistence(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "config.json")
	cfg, err := NewConfig(file, filepath.Join(dir, "accounts.json"), filepath.Join(dir, "lightning.json"))
	require.NoError(t, err)
	require.NoError(t, cfg.SetWhatsNew(WhatsNew{Version: "4.52.0"}, "whats-new-4.52.0"))
	state := WhatsNew{Version: "4.53.0"}
	require.NoError(t, cfg.SetWhatsNew(state, ""))
	stale := cfg.AppConfig()
	require.NoError(t, cfg.SetWhatsNew(state, "whats-new-4.53.0"))
	require.NotContains(t, stale.Frontend, "whats-new-4.53.0")
	// A settings update cannot overwrite backend-managed release-note state.
	stale.Backend.UserLanguage = "de"
	stale.Backend.WhatsNew = nil
	stale.Frontend = map[string]interface{}{"whats-new-4.53.0": false, "guideShown": true}
	require.NoError(t, cfg.SetAppConfig(stale))
	require.Equal(t, &state, cfg.AppConfig().Backend.WhatsNew)
	reloaded, err := NewConfig(file, filepath.Join(dir, "accounts.json"), filepath.Join(dir, "lightning.json"))
	require.NoError(t, err)
	require.Equal(t, &state, reloaded.AppConfig().Backend.WhatsNew)
	require.Equal(t, "de", reloaded.AppConfig().Backend.UserLanguage)
	frontend := map[string]interface{}{
		"whats-new-4.52.0": true,
		"whats-new-4.53.0": true,
		"guideShown":       true,
	}
	require.Equal(t, frontend, reloaded.AppConfig().Frontend)

	cfg.appConfigFilename = dir // A directory cannot be overwritten as a file.
	require.Error(t, cfg.SetWhatsNew(WhatsNew{Version: "4.54.0"}, "whats-new-4.54.0"))
	require.Equal(t, &state, cfg.AppConfig().Backend.WhatsNew)
	require.Equal(t, frontend, cfg.AppConfig().Frontend)
}

func TestWhatsNewMigration(t *testing.T) {
	for _, test := range []struct {
		name      string
		state     string
		dismissed bool
	}{
		{"legacy dismissed", `{"version":"4.53.0","pending":false}`, true},
		{"legacy undismissed", `{"version":"4.53.0","pending":true}`, false},
		{"undismissed", `{"version":"4.53.0"}`, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			dir := t.TempDir()
			file := filepath.Join(dir, "config.json")
			data := `{"backend":{"whatsNew":` + test.state + `},"frontend":{"guideShown":true}}`
			require.NoError(t, os.WriteFile(file, []byte(data), 0600))
			cfg, err := NewConfig(file, filepath.Join(dir, "accounts.json"), filepath.Join(dir, "lightning.json"))
			require.NoError(t, err)
			require.Equal(t, &WhatsNew{Version: "4.53.0"}, cfg.AppConfig().Backend.WhatsNew)
			frontend := cfg.AppConfig().Frontend.(map[string]interface{})
			require.Equal(t, true, frontend["guideShown"])
			if test.dismissed {
				require.Equal(t, true, frontend["whats-new-4.53.0"])
			} else {
				require.NotContains(t, frontend, "whats-new-4.53.0")
			}
			saved, err := os.ReadFile(file)
			require.NoError(t, err)
			require.NotContains(t, string(saved), `"pending"`)
		})
	}
}
