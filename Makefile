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
	go get -u gopkg.in/alecthomas/gometalinter.v1
	gometalinter.v1 --install
	go get -u github.com/golang/dep/cmd/dep
	go get -u github.com/stretchr/testify # needed for mockery
	go get -u github.com/vektra/mockery/cmd/mockery
	go get golang.org/x/tools/cmd/goimports
	go get -u github.com/jteeuwen/go-bindata/...
init:
	make envinit
	dep ensure
	make generate
servewallet:
	go install ./cmd/servewallet/... && servewallet
servewallet-mainnet:
	go install ./cmd/servewallet/... && servewallet -mainnet
servewallet-regtest:
	go install ./cmd/servewallet/... && servewallet -regtest
servewallet-multisig:
	go install ./cmd/servewallet/... && servewallet -multisig
generate:
	rm -rf ${WEBROOT}/build
	yarn --cwd=${WEBROOT} install
	yarn --cwd=${WEBROOT} run build
	go generate ./...
webdev:
	make -C frontends/web dev
weblint:
	make -C frontends/web lint
qt:
	make generate
	make -C frontends/qt
qt-linux: # run inside dockerdev
	make generate
	make -C frontends/qt linux
qt-osx: # run on OSX.
	make generate
	make -C frontends/qt osx
ci:
	./scripts/ci.sh
ci-fast:
	./scripts/ci.sh --fast
dockerinit:
	docker build --pull --force-rm -t bitbox-wallet .
dockerdev:
	./scripts/dockerdev.sh
