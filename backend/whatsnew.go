// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	_ "image/jpeg" // Register supported release-note image formats.
	_ "image/png"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/util"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
)

// Published by app-updates. Override with -ldflags -X for local testing.
var whatsNewProdURL = "https://bitboxapp.shiftcrypto.io/whats-new/"
var whatsNewDevURL = "https://bitboxapp.shiftcrypto.dev/whats-new/"

const (
	whatsNewMaxJSONSize  = 1024 * 1024
	whatsNewMaxImageSize = 2 * 1024 * 1024
)

// WhatsNewNotes is a version's remotely published release-note document.
type WhatsNewNotes struct {
	SchemaVersion int                 `json:"schemaVersion"`
	Version       string              `json:"version"`
	Highlights    []WhatsNewHighlight `json:"highlights"`
}

// WhatsNewHighlight is one page, optionally restricted to a platform group.
type WhatsNewHighlight struct {
	Group   string                     `json:"group"`
	Image   string                     `json:"image,omitempty"`
	Content map[string]WhatsNewContent `json:"content"`
}

// WhatsNewContent contains a complete translation of one page.
type WhatsNewContent struct {
	Title       string        `json:"title"`
	Description string        `json:"description"`
	ImageAlt    string        `json:"imageAlt,omitempty"`
	Link        *WhatsNewLink `json:"link,omitempty"`
}

// WhatsNewLink opens an optional external destination without dismissing the dialog.
type WhatsNewLink struct {
	Href string `json:"href"`
	Text string `json:"text"`
}

type whatsNewImage struct {
	once sync.Once
	data string
}

type whatsNew struct {
	config  *config.Config
	version string
	baseURL string
	client  *http.Client

	lock     locker.Locker
	eligible bool
	checked  bool
	notes    *WhatsNewNotes
	images   map[string]*whatsNewImage
}

func whatsNewURL(devServers bool) string {
	if devServers {
		return whatsNewDevURL
	}
	return whatsNewProdURL
}

func newWhatsNew(cfg *config.Config, version *semver.SemVer, baseURL string, client *http.Client) *whatsNew {
	notes := &whatsNew{
		config: cfg, version: version.String(), baseURL: baseURL, client: client,
		images: map[string]*whatsNewImage{},
	}
	appConfig := cfg.AppConfig()
	state := config.WhatsNew{}
	dismissibleKey := ""
	if appConfig.Backend.WhatsNew != nil {
		state = *appConfig.Backend.WhatsNew
	} else {
		frontend, _ := appConfig.Frontend.(map[string]interface{})
		state.Version, _ = frontend["whatsNewHandledVersion"].(string)
		if handled, err := semver.NewSemVerFromString(state.Version); err == nil {
			dismissibleKey = "whats-new-" + handled.String()
		}
	}
	highest, err := semver.NewSemVerFromString(state.Version)
	switch {
	case err != nil:
		state = config.WhatsNew{Version: notes.version}
		dismissibleKey = "whats-new-" + notes.version
	case !highest.AtLeast(version):
		state = config.WhatsNew{Version: notes.version}
	default:
		state.Version = highest.String()
	}
	if appConfig.Backend.WhatsNew == nil || *appConfig.Backend.WhatsNew != state || dismissibleKey != "" {
		if err := cfg.SetWhatsNew(state, dismissibleKey); err != nil {
			logging.Get().WithGroup("whats-new").WithError(err).Warn("Could not save release-note state")
			return notes
		}
	}
	frontend, _ := cfg.AppConfig().Frontend.(map[string]interface{})
	notes.eligible = state.Version == notes.version && frontend["whats-new-"+notes.version] != true
	return notes
}

// get coalesces requests and keeps the fetched document stable for this launch.
func (notes *whatsNew) get() *WhatsNewNotes {
	defer notes.lock.Lock()()
	if !notes.eligible || notes.baseURL == "" {
		return nil
	}
	if !notes.checked {
		notes.checked = true
		body, err := notes.fetch(notes.version+".json", whatsNewMaxJSONSize)
		if err == nil {
			notes.notes, err = decodeWhatsNew(body, notes.version)
		}
		if err != nil {
			logging.Get().WithGroup("whats-new").WithError(err).Warn("Could not load release notes")
		}
	}
	return notes.notes
}

func (notes *whatsNew) dismiss(version string) error {
	defer notes.lock.Lock()()
	if version != notes.version || notes.notes == nil || len(notes.notes.Highlights) == 0 {
		return errp.New("No release notes to dismiss for this version")
	}
	if !notes.eligible {
		return nil
	}
	if err := notes.config.SetWhatsNew(config.WhatsNew{Version: version}, "whats-new-"+version); err != nil {
		return err
	}
	notes.eligible = false
	return nil
}

func decodeWhatsNew(body []byte, version string) (*WhatsNewNotes, error) {
	var notes WhatsNewNotes
	if err := json.Unmarshal(body, &notes); err != nil {
		return nil, errp.WithStack(err)
	}
	if notes.SchemaVersion != 1 || notes.Version != version || notes.Highlights == nil || len(notes.Highlights) > 20 {
		return nil, errp.New("Invalid release-note schema, version, or highlights")
	}
	for _, highlight := range notes.Highlights {
		switch highlight.Group {
		case "common", "mobile", "desktop", "android", "ios":
		default:
			return nil, errp.New("Invalid release-note platform group")
		}
		if _, ok := highlight.Content["en"]; !ok {
			return nil, errp.New("Release notes require English content")
		}
		if highlight.Image != "" && !validWhatsNewPath(highlight.Image) {
			return nil, errp.New("Invalid release-note image path")
		}
		englishHasLink := highlight.Content["en"].Link != nil
		for language, content := range highlight.Content {
			if strings.TrimSpace(language) == "" || strings.TrimSpace(content.Title) == "" ||
				strings.TrimSpace(content.Description) == "" ||
				(highlight.Image != "" && strings.TrimSpace(content.ImageAlt) == "") ||
				(content.Link != nil) != englishHasLink {
				return nil, errp.New("Incomplete release-note translation")
			}
			if link := content.Link; link != nil {
				if strings.TrimSpace(link.Text) == "" || !strings.HasPrefix(link.Href, "https://") ||
					!isWhitelistedSystemOpenURL(link.Href) {
					return nil, errp.New("Invalid release-note link")
				}
			}
		}
	}
	return &notes, nil
}

func validWhatsNewPath(asset string) bool {
	return asset != "" && asset != "." && asset != ".." &&
		!strings.HasPrefix(asset, "/") && !strings.HasPrefix(asset, "../") &&
		!strings.ContainsAny(asset, "\\:%?#") && path.Clean(asset) == asset
}

func (notes *whatsNew) fetch(asset string, maxSize int64) ([]byte, error) {
	base, err := url.Parse(notes.baseURL)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	// Plain HTTP is only permitted for local fixture servers.
	localHTTP := base.Scheme == "http" && net.ParseIP(base.Hostname()).IsLoopback()
	if (!localHTTP && base.Scheme != "https") || base.Host == "" || base.User != nil ||
		base.RawQuery != "" || base.Fragment != "" || base.RawPath != "" ||
		!validWhatsNewPath(asset) {
		return nil, errp.New("Invalid release-note URL")
	}
	base.Path = strings.TrimRight(path.Clean("/"+base.Path), "/") + "/"
	client := *notes.client
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) >= 10 || req.URL.Scheme != base.Scheme || req.URL.Host != base.Host ||
			req.URL.User != nil || req.URL.RawPath != "" ||
			!strings.HasPrefix(path.Clean(req.URL.Path), base.Path) {
			return errp.New("Release-note redirect outside the configured directory")
		}
		return nil
	}
	_, body, err := util.HTTPGet(&client, base.JoinPath(asset).String(), "", maxSize)
	return body, err
}

func (notes *whatsNew) getImage(version, asset string) string {
	unlock := notes.lock.Lock()
	if !notes.eligible || version != notes.version || notes.notes == nil || asset == "" {
		unlock()
		return ""
	}
	found := false
	for _, highlight := range notes.notes.Highlights {
		if highlight.Image == asset {
			found = true
			break
		}
	}
	if !found {
		unlock()
		return ""
	}
	cached := notes.images[asset]
	if cached == nil {
		cached = &whatsNewImage{}
		notes.images[asset] = cached
	}
	unlock()
	cached.once.Do(func() {
		body, err := notes.fetch(asset, whatsNewMaxImageSize)
		if err == nil {
			var dimensions image.Config
			var format string
			dimensions, format, err = image.DecodeConfig(bytes.NewReader(body))
			if err == nil && (format != "png" && format != "jpeg" ||
				dimensions.Width <= 0 || dimensions.Height <= 0 ||
				int64(dimensions.Width)*int64(dimensions.Height) > 16*1024*1024) {
				err = errp.New("Unsupported release-note image format or dimensions")
			}
			if err == nil {
				cached.data = "data:image/" + format + ";base64," + base64.StdEncoding.EncodeToString(body)
			}
		}
		if err != nil {
			logging.Get().WithGroup("whats-new").WithError(err).Warn("Could not load release-note image")
		}
	})
	return cached.data
}

// GetWhatsNew returns pending remote notes, or nil when nothing should be shown.
func (backend *Backend) GetWhatsNew() *WhatsNewNotes {
	return backend.whatsNew.get()
}

// DismissWhatsNew persists dismissal of the displayed version's notes.
func (backend *Backend) DismissWhatsNew(version string) error {
	return backend.whatsNew.dismiss(version)
}

// GetWhatsNewImage returns a cached image through the JSON/native transport.
func (backend *Backend) GetWhatsNewImage(version, asset string) string {
	return backend.whatsNew.getImage(version, asset)
}
