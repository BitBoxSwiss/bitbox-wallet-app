SHELL:=/bin/bash
WEBROOT:=`pwd`/frontends/web

init:
	cd vendor/github.com/vektra/mockery && go install ./...
	go get -u github.com/jteeuwen/go-bindata/...
	make generate
servewallet:
	cd cmd/servewallet && go install ./... && servewallet
generate:
	yarn --cwd=${WEBROOT} install
	yarn --cwd=${WEBROOT} run build
	WEBASSETS="${WEBROOT}/build" go generate ./...
webdev:
	make -C frontends/web dev
qt:
	make generate
	make -C frontends/qt
