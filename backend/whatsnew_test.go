// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/stretchr/testify/require"
)

func whatsNewConfig(t *testing.T, legacy interface{}) *config.Config {
	t.Helper()
	dir := t.TempDir()
	cfg, err := config.NewConfig(filepath.Join(dir, "config.json"), filepath.Join(dir, "accounts.json"), filepath.Join(dir, "lightning.json"))
	require.NoError(t, err)
	require.NoError(t, cfg.ModifyAppConfig(func(app *config.AppConfig) error {
		app.Frontend = map[string]interface{}{"whatsNewHandledVersion": legacy}
		return nil
	}))
	return cfg
}

func whatsNewVersion(t *testing.T, version string) *semver.SemVer {
	t.Helper()
	parsed, err := semver.NewSemVerFromString(version)
	require.NoError(t, err)
	return parsed
}

func whatsNewFixture(t *testing.T) []byte {
	t.Helper()
	body, err := os.ReadFile("testdata/whats-new/4.53.0.json")
	require.NoError(t, err)
	return body
}

type whatsNewTransport func(*http.Request) (*http.Response, error)

func (transport whatsNewTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

func TestWhatsNewEligibility(t *testing.T) {
	for _, test := range []struct {
		name     string
		current  string
		legacy   interface{}
		version  string
		eligible bool
	}{
		{"fresh install", "4.53.0", nil, "4.53.0", false},
		{"invalid marker", "4.53.0", "invalid", "4.53.0", false},
		{"non-string marker", "4.53.0", 42, "4.53.0", false},
		{"handled", "4.53.0", "4.53.0", "4.53.0", false},
		{"normalized", "4.53.0", "v4.53.0", "4.53.0", false},
		{"major upgrade", "5.0.0", "4.99.99", "5.0.0", true},
		{"minor upgrade", "4.53.0", "4.52.9", "4.53.0", true},
		{"patch upgrade", "4.53.1", "4.53.0", "4.53.1", true},
		{"numeric ordering", "4.10.0", "4.9.0", "4.10.0", true},
		{"skipped versions", "4.53.0", "4.10.0", "4.53.0", true},
		{"downgrade", "4.52.0", "4.53.0", "4.53.0", false},
		{"numeric downgrade", "4.9.0", "4.10.0", "4.10.0", false},
	} {
		t.Run(test.name, func(t *testing.T) {
			cfg := whatsNewConfig(t, test.legacy)
			var requests atomic.Int32
			client := &http.Client{Transport: whatsNewTransport(func(request *http.Request) (*http.Response, error) {
				requests.Add(1)
				require.Equal(t, "/whats-new/latest.json", request.URL.Path)
				_, hasDeadline := request.Context().Deadline()
				require.True(t, hasDeadline)
				return nil, context.DeadlineExceeded
			})}
			notes := newWhatsNew(cfg, whatsNewVersion(t, test.current), "https://notes.example/whats-new/", client)
			require.Equal(t, &config.WhatsNew{Version: test.version}, cfg.AppConfig().Backend.WhatsNew)
			require.Equal(t, test.eligible, notes.eligible)
			for range 2 {
				require.Nil(t, notes.get())
			}
			if test.eligible {
				require.EqualValues(t, 1, requests.Load())
			} else {
				require.Zero(t, requests.Load())
			}
		})
	}
}

func TestWhatsNewLatePublicationAndDismissal(t *testing.T) {
	fixture := whatsNewFixture(t)
	var requests atomic.Int32
	var available atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if !available.Load() {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, _ = w.Write(fixture)
	}))
	defer server.Close()
	cfg := whatsNewConfig(t, "4.52.0")
	launch := func(version string) *whatsNew {
		return newWhatsNew(cfg, whatsNewVersion(t, version), server.URL+"/whats-new/", server.Client())
	}
	notes := launch("4.53.0")
	require.Nil(t, notes.get())
	require.Error(t, notes.dismiss("4.53.0"))
	require.NotContains(t, cfg.AppConfig().Frontend, "whats-new-4.53.0")
	available.Store(true)
	require.Nil(t, notes.get()) // One attempt per launch, including failures.
	require.EqualValues(t, 1, requests.Load())
	require.Nil(t, launch("4.52.0").get())
	require.Equal(t, &config.WhatsNew{Version: "4.53.0"}, cfg.AppConfig().Backend.WhatsNew)

	notes = launch("4.53.0")
	var group sync.WaitGroup
	for range 5 {
		group.Go(func() { notes.get() })
	}
	group.Wait()
	require.EqualValues(t, 2, requests.Load())
	require.Len(t, notes.get().Highlights, 2)
	require.Error(t, notes.dismiss("4.52.0"))
	require.NotContains(t, cfg.AppConfig().Frontend, "whats-new-4.53.0")
	// A new launch without dismissal still shows the notes.
	notes = launch("4.53.0")
	require.NotNil(t, notes.get())
	require.NoError(t, notes.dismiss("4.53.0"))
	require.NoError(t, notes.dismiss("4.53.0"))
	require.Equal(t, true, cfg.AppConfig().Frontend.(map[string]interface{})["whats-new-4.53.0"])
	require.Nil(t, notes.get())
	require.Nil(t, launch("4.53.0").get())
	require.Nil(t, launch("4.52.0").get())
	require.EqualValues(t, 3, requests.Load())
	launch("4.54.0")
	require.Equal(t, &config.WhatsNew{Version: "4.54.0"}, cfg.AppConfig().Backend.WhatsNew)
	require.NotContains(t, cfg.AppConfig().Frontend, "whats-new-4.54.0")
	require.Equal(t, true, cfg.AppConfig().Frontend.(map[string]interface{})["whats-new-4.53.0"])
}

func TestWhatsNewLatestVersion(t *testing.T) {
	for _, test := range []struct {
		name      string
		current   string
		published string
		handled   bool
		empty     bool
	}{
		{"matching", "4.53.0", "4.53.0", false, false},
		{"newer patch", "4.53.0", "4.53.1", true, false},
		{"newer minor", "4.53.0", "4.54.0", true, false},
		{"newer major", "4.99.0", "5.0.0", true, false},
		{"numeric newer", "4.9.0", "4.10.0", true, false},
		{"older", "4.54.0", "4.53.0", false, false},
		{"numeric older", "4.10.0", "4.9.0", false, false},
		{"empty matching", "4.53.0", "4.53.0", false, true},
		{"empty newer", "4.53.0", "4.54.0", true, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			var document WhatsNewNotes
			require.NoError(t, json.Unmarshal(whatsNewFixture(t), &document))
			document.Version = test.published
			if test.empty {
				document.Highlights = []WhatsNewHighlight{}
			}
			body, err := json.Marshal(document)
			require.NoError(t, err)
			var requests atomic.Int32
			client := &http.Client{Transport: whatsNewTransport(func(request *http.Request) (*http.Response, error) {
				require.Equal(t, "/whats-new/latest.json", request.URL.Path)
				requests.Add(1)
				return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(body))}, nil
			})}
			dir := t.TempDir()
			loadConfig := func() *config.Config {
				cfg, err := config.NewConfig(filepath.Join(dir, "config.json"), filepath.Join(dir, "accounts.json"), filepath.Join(dir, "lightning.json"))
				require.NoError(t, err)
				return cfg
			}
			cfg := loadConfig()
			require.NoError(t, cfg.SetWhatsNew(config.WhatsNew{Version: "0.0.0"}, ""))
			for range 2 {
				notes := newWhatsNew(cfg, whatsNewVersion(t, test.current), "https://notes.example/whats-new/", client)
				got := notes.get()
				if test.current == test.published {
					require.Equal(t, &document, got)
				} else {
					require.Nil(t, got)
					require.Error(t, notes.dismiss(test.current))
				}
				cfg = loadConfig()
				require.Equal(t, test.current, cfg.AppConfig().Backend.WhatsNew.Version)
			}
			if test.handled {
				require.EqualValues(t, 1, requests.Load())
				require.Equal(t, true, cfg.AppConfig().Frontend.(map[string]interface{})["whats-new-"+test.current])
				// A later upgrade can still display the newly supported release.
				notes := newWhatsNew(cfg, whatsNewVersion(t, test.published), "https://notes.example/whats-new/", client)
				require.Equal(t, &document, notes.get())
				require.EqualValues(t, 2, requests.Load())
				require.NotContains(t, cfg.AppConfig().Frontend, "whats-new-"+test.published)
			} else {
				require.EqualValues(t, 2, requests.Load())
				require.NotContains(t, cfg.AppConfig().Frontend, "whats-new-"+test.current)
				// Delayed content becomes available for the installed version.
				document.Version = test.current
				body, err = json.Marshal(document)
				require.NoError(t, err)
				notes := newWhatsNew(cfg, whatsNewVersion(t, test.current), "https://notes.example/whats-new/", client)
				require.Equal(t, &document, notes.get())
			}
		})
	}
}

func TestWhatsNewFreshInstallAndDisabledEndpoint(t *testing.T) {
	cfg := whatsNewConfig(t, nil)
	version := whatsNewVersion(t, "4.53.0")
	client := &http.Client{Transport: whatsNewTransport(func(*http.Request) (*http.Response, error) {
		t.Fatal("unexpected fetch")
		return nil, nil
	})}
	require.Nil(t, newWhatsNew(cfg, version, "https://notes.example/", client).get())
	require.Nil(t, newWhatsNew(cfg, version, "https://notes.example/", client).get())
	require.Equal(t, true, cfg.AppConfig().Frontend.(map[string]interface{})["whats-new-4.53.0"])
	notes := newWhatsNew(cfg, whatsNewVersion(t, "4.54.0"), "", client)
	require.Nil(t, notes.get())
	require.NotContains(t, cfg.AppConfig().Frontend, "whats-new-4.54.0")
	// Upgrade again while notes are pending: only the newest release remains pending.
	newWhatsNew(cfg, whatsNewVersion(t, "4.55.0"), "", client)
	require.Equal(t, &config.WhatsNew{Version: "4.55.0"}, cfg.AppConfig().Backend.WhatsNew)
	require.NotContains(t, cfg.AppConfig().Frontend, "whats-new-4.55.0")
	// Returning to an older release must not show its undismissed notes.
	require.Nil(t, newWhatsNew(cfg, whatsNewVersion(t, "4.54.0"), "https://notes.example/", client).get())
}

func TestDecodeWhatsNew(t *testing.T) {
	fixture := whatsNewFixture(t)
	for _, test := range []struct {
		name   string
		change func(*WhatsNewNotes)
	}{
		{"schema", func(n *WhatsNewNotes) { n.SchemaVersion = 2 }},
		{"invalid version", func(n *WhatsNewNotes) { n.Version = "invalid" }},
		{"missing version", func(n *WhatsNewNotes) { n.Version = "" }},
		{"noncanonical version", func(n *WhatsNewNotes) { n.Version = "v4.53.0" }},
		{"negative version", func(n *WhatsNewNotes) { n.Version = "-1.0.0" }},
		{"overflowing version", func(n *WhatsNewNotes) { n.Version = "65536.0.0" }},
		{"missing highlights", func(n *WhatsNewNotes) { n.Highlights = nil }},
		{"group", func(n *WhatsNewNotes) { n.Highlights[0].Group = "windows" }},
		{"missing English", func(n *WhatsNewNotes) { delete(n.Highlights[0].Content, "en") }},
		{"incomplete translation", func(n *WhatsNewNotes) { n.Highlights[0].Content["de"] = WhatsNewContent{Title: "Titel"} }},
		{"image path", func(n *WhatsNewNotes) { n.Highlights[0].Image = "../secret.png" }},
		{"missing alt", func(n *WhatsNewNotes) {
			c := n.Highlights[0].Content["en"]
			c.ImageAlt = ""
			n.Highlights[0].Content["en"] = c
		}},
		{"unsafe link", func(n *WhatsNewNotes) { n.Highlights[1].Content["en"].Link.Href = "javascript:alert(1)" }},
		{"unapproved host", func(n *WhatsNewNotes) {
			n.Highlights[1].Content["en"].Link.Href = "https://blog.bitbox.swiss.example.com/"
		}},
		{"link credentials", func(n *WhatsNewNotes) { n.Highlights[1].Content["en"].Link.Href = "https://user@blog.bitbox.swiss/" }},
		{"missing label", func(n *WhatsNewNotes) { n.Highlights[1].Content["en"].Link.Text = " " }},
		{"missing localized link", func(n *WhatsNewNotes) {
			c := n.Highlights[1].Content["de"]
			c.Link = nil
			n.Highlights[1].Content["de"] = c
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			notes, err := decodeWhatsNew(fixture)
			require.NoError(t, err)
			test.change(notes)
			body, err := json.Marshal(notes)
			require.NoError(t, err)
			_, err = decodeWhatsNew(body)
			require.Error(t, err)
		})
	}
	_, err := decodeWhatsNew([]byte("{"))
	require.Error(t, err)
	empty, err := decodeWhatsNew([]byte(`{"schemaVersion":1,"version":"4.53.0","highlights":[]}`))
	require.NoError(t, err)
	require.Empty(t, empty.Highlights)
}

func TestWhatsNewInvalidContentRemainsPending(t *testing.T) {
	for _, body := range []string{
		"{", "null", `{"schemaVersion":1,"version":"4.53.0","highlights":[]}`,
		`{"schemaVersion":2,"version":"4.54.0","highlights":[]}`,
		`{"schemaVersion":1,"version":"4.54.0","highlights":[{"group":"common","content":{}}]}`,
		`{"schemaVersion":1,"version":"invalid","highlights":[]}`,
		strings.Repeat(" ", whatsNewMaxJSONSize+1),
	} {
		cfg := whatsNewConfig(t, "4.52.0")
		client := &http.Client{Transport: whatsNewTransport(func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}, nil
		})}
		notes := newWhatsNew(cfg, whatsNewVersion(t, "4.53.0"), "https://notes.example/", client)
		notes.get()
		require.Error(t, notes.dismiss("4.53.0"))
		require.NotContains(t, cfg.AppConfig().Frontend, "whats-new-4.53.0")
	}
}

func TestWhatsNewImages(t *testing.T) {
	fixture := whatsNewFixture(t)
	var pngData bytes.Buffer
	require.NoError(t, png.Encode(&pngData, image.NewRGBA(image.Rect(0, 0, 2, 2))))
	for _, test := range []struct {
		name string
		body []byte
		ok   bool
	}{
		{"PNG", pngData.Bytes(), true},
		{"HTML", []byte("<html>not an image</html>"), false},
		{"SVG", []byte(`<svg xmlns="http://www.w3.org/2000/svg"/>`), false},
		{"oversized", bytes.Repeat([]byte{0}, whatsNewMaxImageSize+1), false},
	} {
		t.Run(test.name, func(t *testing.T) {
			var images atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/whats-new/latest.json" {
					_, _ = w.Write(fixture)
					return
				}
				images.Add(1)
				_, _ = w.Write(test.body)
			}))
			defer server.Close()
			notes := newWhatsNew(whatsNewConfig(t, "4.52.0"), whatsNewVersion(t, "4.53.0"), server.URL+"/whats-new/", server.Client())
			require.NotNil(t, notes.get())
			require.Empty(t, notes.getImage("4.53.0", "unknown.png"))
			require.Empty(t, notes.getImage("4.52.0", "images/preview.png"))
			for range 2 {
				data := notes.getImage("4.53.0", "images/preview.png")
				if test.ok {
					require.Equal(t, "data:image/png;base64,"+base64.StdEncoding.EncodeToString(test.body), data)
				} else {
					require.Empty(t, data)
				}
			}
			require.EqualValues(t, 1, images.Load())
			require.NoError(t, notes.dismiss("4.53.0"))
		})
	}
}

func TestWhatsNewAssetPathsAndRedirects(t *testing.T) {
	for _, asset := range []string{"", ".", "..", "../image.png", "images/../image.png", "/image.png", "//example.com/i.png", "https://example.com/i.png", "images/%2e%2e/i.png", "images\\i.png", "image.png?x=1", "image.png#x"} {
		require.False(t, validWhatsNewPath(asset), asset)
	}
	require.True(t, validWhatsNewPath("images/preview.png"))
	var redirected atomic.Int32
	outside := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { redirected.Add(1) }))
	defer outside.Close()
	for _, destination := range []string{outside.URL + "/whats-new/image.png", "/private/image.png", "/whats-new/%2e%2e/private.png", "/whats-new/allowed.png"} {
		t.Run(destination, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/whats-new/image.png" {
					http.Redirect(w, r, destination, http.StatusFound)
					return
				}
				_, _ = w.Write([]byte("image"))
			}))
			defer server.Close()
			notes := &whatsNew{baseURL: server.URL + "/whats-new/", client: server.Client()}
			_, err := notes.fetch("image.png", 32)
			if destination == "/whats-new/allowed.png" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
	require.Zero(t, redirected.Load())
}

func TestWhatsNewEndpointSelection(t *testing.T) {
	prod, dev := whatsNewProdURL, whatsNewDevURL
	t.Cleanup(func() { whatsNewProdURL, whatsNewDevURL = prod, dev })
	whatsNewProdURL, whatsNewDevURL = "https://prod.example/", "https://dev.example/"
	require.Equal(t, whatsNewProdURL, whatsNewURL(false))
	require.Equal(t, whatsNewDevURL, whatsNewURL(true))
}

func TestWhatsNewPersistenceFailure(t *testing.T) {
	for _, onDismiss := range []bool{false, true} {
		t.Run(map[bool]string{false: "upgrade", true: "dismissal"}[onDismiss], func(t *testing.T) {
			dir := t.TempDir()
			file := filepath.Join(dir, "config.json")
			cfg, err := config.NewConfig(file, filepath.Join(dir, "accounts.json"), filepath.Join(dir, "lightning.json"))
			require.NoError(t, err)
			require.NoError(t, cfg.SetWhatsNew(config.WhatsNew{Version: "4.52.0"}, "whats-new-4.52.0"))
			fixture := whatsNewFixture(t)
			var requests atomic.Int32
			client := &http.Client{Transport: whatsNewTransport(func(*http.Request) (*http.Response, error) {
				requests.Add(1)
				return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(fixture))}, nil
			})}
			var notes *whatsNew
			if onDismiss {
				notes = newWhatsNew(cfg, whatsNewVersion(t, "4.53.0"), "https://notes.example/", client)
				require.NotNil(t, notes.get())
			}
			require.NoError(t, os.Remove(file))
			require.NoError(t, os.Mkdir(file, 0700))
			if onDismiss {
				require.Error(t, notes.dismiss("4.53.0"))
				require.NotContains(t, cfg.AppConfig().Frontend, "whats-new-4.53.0")
				require.NotNil(t, notes.get())
			} else {
				notes = newWhatsNew(cfg, whatsNewVersion(t, "4.53.0"), "https://notes.example/", client)
				require.Nil(t, notes.get())
				require.Zero(t, requests.Load())
				require.Equal(t, "4.52.0", cfg.AppConfig().Backend.WhatsNew.Version)
			}
		})
	}
}

func TestWhatsNewSupersededPersistenceFailure(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "config.json")
	cfg, err := config.NewConfig(file, filepath.Join(dir, "accounts.json"), filepath.Join(dir, "lightning.json"))
	require.NoError(t, err)
	require.NoError(t, cfg.SetWhatsNew(config.WhatsNew{Version: "4.52.0"}, "whats-new-4.52.0"))
	var requests atomic.Int32
	client := &http.Client{Transport: whatsNewTransport(func(*http.Request) (*http.Response, error) {
		requests.Add(1)
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(`{"schemaVersion":1,"version":"4.54.0","highlights":[]}`)),
		}, nil
	})}
	launch := func() *whatsNew {
		return newWhatsNew(cfg, whatsNewVersion(t, "4.53.0"), "https://notes.example/", client)
	}
	notes := launch()
	require.NoError(t, os.Remove(file))
	require.NoError(t, os.Mkdir(file, 0700))
	require.Nil(t, notes.get())
	require.True(t, notes.eligible)
	require.NotContains(t, cfg.AppConfig().Frontend, "whats-new-4.53.0")
	require.NoError(t, os.Remove(file))
	require.Nil(t, launch().get())
	require.Equal(t, true, cfg.AppConfig().Frontend.(map[string]interface{})["whats-new-4.53.0"])
	require.Nil(t, launch().get())
	require.EqualValues(t, 2, requests.Load())
}
