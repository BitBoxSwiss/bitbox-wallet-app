SHELL:=/bin/bash
WEBROOT:=`pwd`/frontends/web

catch:
	@echo "Choose a make target."
envinit:
	go get -u gopkg.in/alecthomas/gometalinter.v1
	gometalinter.v1 --install
	go get -u github.com/golang/dep/cmd/dep
	go get -u github.com/stretchr/testify # needed for mockery
	go get -u github.com/vektra/mockery
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
	yarn --cwd=${WEBROOT} install
	yarn --cwd=${WEBROOT} run build
	WEBASSETS="${WEBROOT}/build" go generate ./...
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
ci:
	./scripts/ci.sh
ci-fast:
	./scripts/ci.sh --fast
dockerinit:
	docker build --pull --force-rm -t godbb .
dockerdev:
	./scripts/dockerdev.sh
