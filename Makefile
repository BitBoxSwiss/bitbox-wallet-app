# Copyright 2018 Shift Devices AG
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

SHELL:=/bin/bash
WEBROOT:=`pwd`/frontends/web

catch:
	@echo "Choose a make target."
envinit:
	curl -sfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh| sh -s -- -b $(GOPATH)/bin v1.19.1
	GO111MODULE=off go get -u github.com/stretchr/testify # needed for mockery
	GO111MODULE=off go get -u github.com/vektra/mockery/cmd/mockery
	GO111MODULE=off go get -u github.com/goware/modvendor
	GO111MODULE=off go get golang.org/x/tools/cmd/goimports
	GO111MODULE=off go get -u github.com/jteeuwen/go-bindata/...
	GO111MODULE=off go get -u golang.org/x/mobile/cmd/gomobile
	gomobile init
# This must be run in $GOPATH/src/github.com/digitalbitbox/bitbox-wallet-app
osx-init:
	/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
	brew install yarn
	brew install go
	brew install qt
	export PATH="/usr/local/opt/qt/bin:$PATH"
	export LDFLAGS="-L/usr/local/opt/qt/lib"
	export CPPFLAGS="-I/usr/local/opt/qt/include"
	export GOPATH=~/go/
	export PATH=$PATH:~/go/bin
	$(MAKE) envinit
servewallet:
	go install -mod=vendor ./cmd/servewallet/... && servewallet
servewallet-mainnet:
	go install -mod=vendor ./cmd/servewallet/... && servewallet -mainnet
servewallet-regtest:
	go install -mod=vendor ./cmd/servewallet/... && servewallet -regtest
servewallet-multisig:
	go install -mod=vendor ./cmd/servewallet/... && servewallet -multisig
servewallet-prodservers:
	go install -mod=vendor ./cmd/servewallet/... && servewallet -devservers=false
buildweb:
	node --version
	rm -rf ${WEBROOT}/build
	yarn --cwd=${WEBROOT} install
	yarn --cwd=${WEBROOT} run build
webdev:
	cd frontends/web && $(MAKE) dev
weblint:
	cd frontends/web && $(MAKE) lint
webtest:
	cd frontends/web && $(MAKE) jstest
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
	$(MAKE) buildweb
	cd frontends/android && ${MAKE} apk-debug
osx-sec-check:
	@echo "Checking build output"
	./scripts/osx-build-check.sh
ci:
	./scripts/ci.sh
clean:
	rm -rf ${WEBROOT}/build
	cd frontends/qt && $(MAKE) clean
	cd frontends/android && $(MAKE) clean
dockerinit:
	docker build --pull --force-rm -t bitbox-wallet .
dockerdev:
	./scripts/dockerdev.sh
locize-push:
	cd frontends/web/src/locales && locize sync
locize-pull:
	cd frontends/web/src/locales && locize download
locize-fix:
	locize format ${WEBROOT}/src/locales --format json
go-vendor:
	go mod vendor
	modvendor -copy="**/*.c **/*.h **/*.proto" -v
