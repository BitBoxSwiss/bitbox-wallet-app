SHELL:=/bin/bash
WEBROOT:=`pwd`/frontends/web

envinit:
	go get -u gopkg.in/alecthomas/gometalinter.v1
	gometalinter.v1 --install
	go get -u github.com/golang/dep/cmd/dep
	go get golang.org/x/tools/cmd/goimports
	go get -u github.com/jteeuwen/go-bindata/...
init:
	make envinit
	cd vendor/github.com/vektra/mockery && go install ./...
	dep ensure
	make generate
servewallet:
	go install ./cmd/servewallet/... && servewallet
generate:
	yarn --cwd=${WEBROOT} install
	yarn --cwd=${WEBROOT} run build
	WEBASSETS="${WEBROOT}/build" go generate ./...
webdev:
	make -C frontends/web dev
qt:
	make generate
	make -C frontends/qt
ci:
	./scripts/ci.sh
ci-fast:
	./scripts/ci.sh --fast
dockerinit:
	docker build --force-rm -t godbb .
dockerdev:
	./scripts/dockerdev.sh
