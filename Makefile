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
	./scripts/go-get.sh v1.16.0 github.com/golangci/golangci-lint/cmd/golangci-lint
	go get -u github.com/golang/dep/cmd/dep
	go get -u github.com/stretchr/testify # needed for mockery
	go get -u github.com/vektra/mockery/cmd/mockery
	go get golang.org/x/tools/cmd/goimports
	go get -u github.com/jteeuwen/go-bindata/...
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
	go install ./cmd/servewallet/... && servewallet
servewallet-mainnet:
	go install ./cmd/servewallet/... && servewallet -mainnet
servewallet-regtest:
	go install ./cmd/servewallet/... && servewallet -regtest
servewallet-multisig:
	go install ./cmd/servewallet/... && servewallet -multisig
servewallet-prodservers:
	go install ./cmd/servewallet/... && servewallet -devservers=false
buildweb:
	node --version
	rm -rf ${WEBROOT}/build
	yarn --cwd=${WEBROOT} install
	yarn --cwd=${WEBROOT} run build
webdev:
	cd frontends/web && $(MAKE) dev
webdev-i18n:
	PREACT_APP_I18NEDITOR=1 $(MAKE) webdev
weblint:
	cd frontends/web && $(MAKE) lint
webtest:
	cd frontends/web && $(MAKE) jstest
qt:
	$(MAKE) buildweb
	cd frontends/qt && $(MAKE)
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
osx-sec-check:
	@echo "Checking build output"
	./scripts/osx-build-check.sh
ci:
	./scripts/ci.sh
clean:
	cd frontends/qt && $(MAKE) clean
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
