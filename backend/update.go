// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/versioninfo"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/locker"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/useragent"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
)

const (
	updateFileURL       = "https://bitboxapp.shiftcrypto.io/desktop.json"
	updateCheckInterval = 24 * time.Hour
)

type updateCheckFunc func(context.Context) (*UpdateFile, error)

type updateChecker struct {
	observable.Implementation

	check updateCheckFunc

	latest     *UpdateFile
	revision   uint64
	latestLock locker.Locker
	cancel     context.CancelFunc
}

// UpdateFile is retrieved from the server.
type UpdateFile struct {
	// CurrentVersion stores the current version and is not loaded from the server.
	CurrentVersion *semver.SemVer `json:"current"`

	// NewVersion stores the new version and may not be nil.
	NewVersion *semver.SemVer `json:"version"`

	// Description gives additional information on the release.
	Description string `json:"description"`
}

// UpdateState is the revisioned result of the latest successful update check.
type UpdateState struct {
	Revision uint64      `json:"revision"`
	Update   *UpdateFile `json:"update"`
}

func newUpdateChecker(proxy *socksproxy.SocksProxy, userAgent string) *updateChecker {
	return &updateChecker{
		check: func(ctx context.Context) (*UpdateFile, error) {
			return checkForUpdate(ctx, proxy, userAgent)
		},
	}
}

// checkForUpdate checks whether a newer version of this application has been released.
// It returns the retrieved update file if a newer version has been released and nil otherwise.
func checkForUpdate(ctx context.Context, proxy *socksproxy.SocksProxy, userAgent string) (*UpdateFile, error) {
	client, err := proxy.GetHTTPClient()
	if err != nil {
		return nil, errp.WithStack(err)
	}

	request, err := newUpdateRequest(ctx, userAgent)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, errp.WithStack(err)
	}
	defer func() {
		_ = response.Body.Close()
	}()
	if response.StatusCode != http.StatusOK {
		return nil, errp.Newf("expected 200 OK, got %d", response.StatusCode)
	}
	var updateFile UpdateFile
	err = json.NewDecoder(response.Body).Decode(&updateFile)
	if err != nil {
		return nil, errp.WithStack(err)
	}

	if versioninfo.Version.AtLeast(updateFile.NewVersion) {
		return nil, nil
	}

	updateFile.CurrentVersion = versioninfo.Version
	return &updateFile, nil
}

func newUpdateRequest(ctx context.Context, userAgent string) (*http.Request, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, updateFileURL, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("User-Agent", userAgent)
	return request, nil
}

func (backend *Backend) userAgent() string {
	platform := useragent.PlatformFromRuntime()
	if backend.environment != nil {
		if environmentPlatform := backend.environment.UserAgentPlatform(); environmentPlatform != "" {
			platform = environmentPlatform
		}
	}
	return useragent.String(versioninfo.Version.String(), platform)
}

func (checker *updateChecker) start() {
	ctx, cancel := context.WithCancel(context.Background())
	checker.cancel = cancel
	go checker.run(ctx, updateCheckInterval)
}

func (checker *updateChecker) stop() {
	if checker.cancel != nil {
		checker.cancel()
		checker.cancel = nil
	}
}

// run checks immediately and waits for the interval after each attempt before retrying.
func (checker *updateChecker) run(ctx context.Context, interval time.Duration) {
	for {
		checker.checkAndSet(ctx)

		timer := time.NewTimer(interval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}

func (checker *updateChecker) checkAndSet(ctx context.Context) {
	updateFile, err := checker.check(ctx)
	if ctx.Err() != nil {
		return
	}
	if err != nil {
		logging.Get().WithGroup("update").WithError(err).Warn("Check for update failed.")
		return
	}
	checker.set(updateFile)
}

func (checker *updateChecker) set(updateFile *UpdateFile) {
	unlock := checker.latestLock.Lock()
	checker.latest = updateFile
	checker.revision++
	state := UpdateState{
		Revision: checker.revision,
		Update:   checker.latest,
	}
	unlock()

	checker.Notify(observable.Event{
		Subject: "update",
		Action:  action.Replace,
		Object:  state,
	})
}

func (checker *updateChecker) get() UpdateState {
	defer checker.latestLock.RLock()()
	return UpdateState{
		Revision: checker.revision,
		Update:   checker.latest,
	}
}

// GetUpdate returns the result of the latest successful update check.
func (backend *Backend) GetUpdate() UpdateState {
	return backend.updateChecker.get()
}
