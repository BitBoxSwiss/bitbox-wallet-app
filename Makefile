# SPDX-License-Identifier: Apache-2.0

SHELL    := /bin/bash
WEBROOT  := frontends/web
MOBILETESTROOT := frontends/mobiletests

include version.mk.inc

GO_LDFLAGS := $(GO_VERSION_LDFLAGS)
GO_RUN := go run -mod=vendor -ldflags "$(GO_LDFLAGS)"

catch:
	@echo "Choose a make target."
envinit:
	curl -sfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(shell go env GOPATH)/bin v2.9.0
	go install github.com/vektra/mockery/v2@v2.53.5
	go install github.com/matryer/moq@v0.6.0
	go install golang.org/x/tools/cmd/goimports@latest
	$(MAKE) gomobileinit
gomobileinit:
	# TODO: replace with go install golang.org/x/mobile/cmd/gomobile@latest once https://github.com/golang/mobile/pull/105 is merged.
	git clone -b bitbox-20260215 https://github.com/BitBoxSwiss/mobile.git /tmp/mobile && cd /tmp/mobile/cmd/gomobile && go install .
	gomobile init
servewallet:
	$(GO_RUN) ./cmd/servewallet
servewallet-mainnet:
	$(GO_RUN) ./cmd/servewallet -mainnet
servewallet-regtest:
	rm -f appfolder.dev/cache/headers-rbtc.bin && rm -rf appfolder.dev/cache/account-*rbtc* && $(GO_RUN) ./cmd/servewallet -regtest
servewallet-prodservers:
	$(GO_RUN) ./cmd/servewallet -devservers=false
servewallet-mainnet-prodservers:
	$(GO_RUN) ./cmd/servewallet -mainnet -devservers=false
servewallet-simulator:
	$(GO_RUN) ./cmd/servewallet -simulator=true
buildweb:
	node --version
	npm --version
	rm -rf ${WEBROOT}/build
	cd ${WEBROOT} && npm ci
	cd ${WEBROOT} && npm run build
webdev:
	cd ${WEBROOT} && $(MAKE) dev
weblint:
	cd ${WEBROOT} && $(MAKE) lint
webfix:
	cd ${WEBROOT} && $(MAKE) fix
webtest:
	cd ${WEBROOT} && $(MAKE) jstest
webtestwatch:
	cd ${WEBROOT} && $(MAKE) jstest-watch
webserve:
	cd ${WEBROOT} && $(MAKE) serve
webe2etest:
	cd ${WEBROOT} && $(MAKE) test-e2e
mobilee2etest:
	cd ${MOBILETESTROOT} && ./run.sh
qt-linux: # run inside dockerdev
	$(MAKE) buildweb
	cd frontends/qt && $(MAKE) linux
qt-osx: # run on OSX.
	$(MAKE) buildweb
	cd frontends/qt && $(MAKE) osx
	$(MAKE) osx-sec-check
qt-windows:
	$(MAKE) buildweb
	cd frontends/qt && $(MAKE) windows
android:
	cd frontends/android && ${MAKE} apk-debug
# Create signed .apk and .aab.
android-assemble-release:
	cd frontends/android && ${MAKE} assemble-release
ios:
	cd frontends/ios && ${MAKE} build
osx-sec-check:
	@echo "Checking build output"
	./scripts/osx-build-check.sh
osx-create-dmg:
	@echo "Creating DMG installer"
	./scripts/osx-create-dmg.sh
ci:
	./scripts/ci.sh
clean:
	rm -rf ${WEBROOT}/build
	cd frontends/qt && $(MAKE) clean
	cd frontends/android && $(MAKE) clean
	cd backend/mobileserver && $(MAKE) clean

# The container image only supports amd64 bercause of "thyrlian/android-sdk"
# that downloads amd64 specific binaries
dockerinit:
	./scripts/container.sh build --platform linux/amd64 --pull -t shiftcrypto/bitbox-wallet-app:$(shell cat .containerversion) .
dockerdev:
	./scripts/dockerdev.sh
locize-push:
	cd ${WEBROOT}/src/locales && locize sync
locize-pull:
	cd ${WEBROOT}/src/locales && locize download
locize-fix:
	locize format ${WEBROOT}/src/locales --format json
go-vendor:
	go mod vendor
update-bitbox02-api-go:
	./scripts/update-bitbox02-api-go.sh
update-btc-checkpoints:
	go run cmd/playground/update_btc_checkpoints/main.go
