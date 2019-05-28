# BitBox Wallet App

This repo contains the source code for the BitBox Wallet App and related tools.

## Tech Stack

The wallet UI is a [preact](https://preactjs.com/) single page webapp. It sources its data from the
backend written in Go.

The Desktop app is a C++ Qt5 program containing only a `WebEngineView`, displaying the UI.

Static assets are sourced from a Qt rcc file, and the dynamic data is bridged from Go with
WebChannels.

The Go library is compiled as a C library which exposes two functions only: one to set up the
bridge, and one to invoke calls in the backend.

Similarly to the Desktop variant, the Go library can be statically compiled and added to an Android
Studio / XCode project. This is not part of this repo yet.

### Compatibility
x86 (no ARM), 64 bit: Windows 7+, macOS 10.11+, Linux 


## Build status

[![Build Status](https://travis-ci.org/digitalbitbox/bitbox-wallet-app.svg?branch=master)](https://travis-ci.org/digitalbitbox/bitbox-wallet-app)
[![Build status](https://ci.appveyor.com/api/projects/status/4c8pc8jpa1utnj26/branch/master?svg=true)](https://ci.appveyor.com/project/benma/bitbox-wallet-app/branch/master)

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

Clone/move this repo to `$GOPATH/src/github.com/digitalbitbox/bitbox-wallet-app` (`$GOPATH` is usually `~/go`).

Only the first time, call `make envinit` to install the required go utilities (linters, dep, ...).

## Build the Bitbox Wallet

Please consult `docs/BUILD.md` for platform specific instructions and further
information.

## I18N Translation Workflow

Please consult `docs/i18n.md`.

## ElectrumX Backend

The servers used are configurable in the app settings. Currently, when running the app in devmode
(`make servewallet`), the config is ignored and servers on Shift's devserver are used. The
hosts/ports/certs of those are currently hardcoded.

## Development Workflow

### Local Development

Run `make servewallet` and `make webdev` in seperate terminals.

Before the first use of `make webdev`, you also need to run `make buildweb`, to install the dev
dependencies.

#### Watch and build the UI

Run `make webdev` to develop the UI inside a web browser (for quick development, automatic rebuilds
and devtools). This serves the UI on [localhost:8080](http://localhost:8080). Changes to the web
code in `frontends/web/src` are automatically detected and rebuilt.

#### UI testing

The tests are run using [jest](https://jestjs.io)
and [ts-jest](https://www.npmjs.com/package/ts-jest) preprocessor.

Because the app is based on [preact](https://preactjs.com),
we use [preact-render-spy](https://www.npmjs.com/package/preact-render-spy) package
instead of [enzyme](https://airbnb.io/enzyme/) to test app components rendering
and their state.

To run all test suites, execute `make webtest`.
If you plan on spending a lot of time in `frontends/web/src` space
or just keen on doing TDD, use jest's tests watcher:

    cd frontends/web/
    make jstest-watch

To generate coverage report, execute `make jstest-cover` from `frontends/web` dir
and open `coverage/lcov-report/index.html` in a browser.

#### Run the HTTP API

Run `make servewallet` to compile the code and run `servewallet`. `servewallet` is a devtool which
serves the HTTP API. Changes to the backend code are *not* automatically detected, so you need to
restart the server after changes.

#### Update go dependencies

Run `dep ensure` to update dependencies.

#### Update npm dependencies

Check outdated dependencies `cd frontends/web && yarn outdated` and `yarn upgrade
modulename@specificversion`.

### CI

Run `make ci` to run all static analysis tools and tests.

### Build the UI

To statically compile the UI, run `make buildweb` again, which compiles the web ui into a compact
bundle.

## Develop using Docker

The Dockerfile provides a Ubuntu container with the whole environment preconfigured. To set it up,
run `make dockerinit`, which builds the Docker image (this takes a while).

After that, `make dockerdev` enters the container (a shell inside an Ubuntu virtual machine), where
you can perform the same steps as in the previous section (`make servewallet` and `make
webdev`).

Before the first use of `make webdev`, you also need to run `make buildweb`, to install the dev
dependencies.

Running `make dockerdev` multiple times shares the same container. You can edit the code
in your usual editor in the host and compile inside the container.

To execute `make servewallet` and `make webdev` insider the container, but from the host, use this:

`$ ./scripts/docker_exec.sh servewallet/webdev`

## Testnet coins

In development mode, any password entered derives a unique testnet wallet.

Get Bitcoin Testnet coins here: https://coinfaucet.eu/en/btc-testnet/

Get Litecoin Testnet coins here: https://tltc.bitaps.com/

Get Ethereum Rinkeby coins here: http://rinkeby-faucet.com/

Get Ethereum Ropsten coins here: https://faucet.ropsten.be/
