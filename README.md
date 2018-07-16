# godbb

This repo contains the source code for the Shift Wallet and related tools.

## Tech Stack

The wallet UI is a [preact](https://preactjs.com/) single page webapp. It sources its data from the
backend written in Go.

The Desktop app is a static C++ Qt5 program containing only a `WebEngineView`, displaying the UI.

Static assets are sourced from a Qt rcc file, and the dynamic data is bridged from Go with
WebChannels.

The Go library is compiled as a C library which exposes two functions only: one to set up the
bridge, and one to invoke calls in the backend.

Similarly to the Desktop variant, the Go library can be statically compiled and added to an Android
Studio / XCode project. This is not part of this repo yet.

## Directories (subject to change)

- `cmd/`: Go projects which generate binaries are here.
- `cmd/servewallet/`: a development aid which serves the static web ui and the http api it talks
  to. See below.
- `vendor/`: Go dependencies, managed by the `dep` tool (see the Requirements section below).
- `backend/coins/btc/electrum/`: A json rpc client library, talking to Electrum servers.
- `backend/devices/bitbox/`: Library to detect and talk to digital bitboxes. High level API access.
- `backend/coins/btc/`: Local HD wallet, sourcing blockchain index from an arbitrary
  backend. Manages addresses, outputs, tx creation, and everything else that a wallet needs to do.
- `backend/`: The library that ties it all together. Uses the above packages to create a wallet
  talking Electrum using the BitBox for signing, and serve a high level HTTP API to control it.
- `frontends/qt/`: the C++/Qt5 app which builds the wallet app for the desktop.
- `frontends/web/`: home of the preact UI.

## Set up the development environment

The below instructions assume a unix environment.

### Requirements

- [Go](https://golang.org/doc/install) version 1.9.2.
- [Yarn](https://yarnpkg.com/en/) - for managing the web UI deps.
- [Qt5](https://www.qt.io)
  - Install via https://www.qt.io/download, also install WebEngine, and put `qmake` and `rcc` into
    your PATH.

Make sure $GOPATH is set and $GOPAH/bin and $GOROOT/bin is in your $PATH

Clone/move this repo to `$GOPATH/src/github.com/shiftdevices/godbb` (`$GOPATH` is usually `~/go`).

Only the first time, set up the project with `make init`.

## ElectrumX Backend

The servers used are configurable in the app settings. Currently, when running the app in devmode
(`make servewallet`), the config is ignored and servers on Shift's devserver are used. The
hosts/ports/certs of those are currently hardcoded.

## Development Workflow

### Local Development

Run `make servewallet` and `make webdev` in seperate terminals.

#### Watch and build the UI

Run `make webdev` to develop the UI inside a web browser (for quick development, automatic rebuilds
and devtools). This serves the UI on [localhost:8080](http://localhost:8080). Changes to the web
code in `frontends/web/src` are automatically detected and rebuilt.

#### Run the HTTP API

Run `make servewallet` to compile the code and run `servewallet`. `servewallet` is a devtool which
serves the HTTP API.

#### Update go dependencies

Run `dep ensure` to update dependencies.

#### Update npm dependencies

Check outdated dependencies `cd frontends/web && yarn outdated` and `yarn upgrade
modulename@specificversion` or just upgrade everything by `yarn upgrade --latest`.

### Production build

To build the standalone desktop app, run `make qt-linux` inside Docker (see below) or `make qt-osx`
on a Mac. Cross compilation is not supported yet.

### CI

Run `make ci` to run all static analysis tools and tests.

### Build the UI

To statically compile the UI, run `make generate` again, which compiles the web ui into a compact
bundle.

## Develop using Docker

The Dockerfile provides a Ubuntu container with the whole environment preconfigured. To set it up,
run `make dockerinit`, which builds the Docker image (this takes a while).

After that, `make dockerdev` enters the container (a shell inside an Ubuntu virtual machine), where
you can perform the same steps as in the previous section (`make servewallet` and `make
webdev`). Running `make dockerdev` multiple times shares the same container. You can edit the code
in your usual editor in the host and compile inside the container.

For the first time after `make dockerinit`, enter the image with `make dockerdev` and run `make
init` to initialize the repo.

To execute `make servewallet` and `make webdev` insider the container, but from the host, use this:

`$ ./scripts/docker_exec.sh servewallet/webdev`
