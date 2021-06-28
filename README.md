# BitBoxApp

This repo contains the source code for the BitBoxApp and related tools.

## Tech stack

The wallet UI is a [preact](https://preactjs.com/) single page webapp. It sources its data from the
backend written in Go.

The Desktop app is a C++ Qt5 program containing only a `WebEngineView`, displaying the UI.

Static assets are sourced from a Qt rcc file, and the dynamic data is bridged from Go with
WebChannels.

The Go library is compiled as a C library which exposes two functions only: one to set up the
bridge, and one to invoke calls in the backend.

Similarly to the Desktop variant, the Go library can be compiled and added to an Android Studio /
XCode project.

## Build status

[![Build Status](https://travis-ci.org/digitalbitbox/bitbox-wallet-app.svg?branch=master)](https://travis-ci.org/digitalbitbox/bitbox-wallet-app)
[![Build status](https://ci.appveyor.com/api/projects/status/4c8pc8jpa1utnj26/branch/master?svg=true)](https://ci.appveyor.com/project/benma/bitbox-wallet-app/branch/master)

## Directories (subject to change)

- `cmd/`: Go projects which generate binaries are here.
- `cmd/servewallet/`: a development aid which serves the static web ui and the http api it talks
  to. See below.
- `vendor/`: Go dependencies, created by `make go-vendor` based on Go modules.
- `backend/coins/btc/electrum/`: A json rpc client library, talking to Electrum servers.
- `backend/devices/{bitbox,bitbox02}/`: Library to detect and talk to BitBoxes. High level API access.
- `backend/coins/btc/`: Local HD wallet, sourcing blockchain index from an arbitrary
  backend. Manages addresses, outputs, tx creation, and everything else that a wallet needs to do.
- `backend/`: The library that ties it all together. Uses the above packages to create a wallet
  talking Electrum using the BitBox for signing, and serve a high level HTTP API to control it.
- `frontends/qt/`: the C++/Qt5 app which builds the wallet app for the desktop.
- `frontends/android/`: Android target (EXPERIMENTAL / ALPHA)
- `frontends/web/`: home of the preact UI.

## Set up the development environment

The below instructions assume a unix environment.

### Requirements

The following dependencies need to be installed:

- [Go](https://golang.org/doc/install) version 1.16
- [Yarn](https://yarnpkg.com/en/) for managing the web UI deps
- [Qt5](https://www.qt.io) version 5.15.2
  - install Qt for your platform, including the WebEngine component

Make sure the following environment variables are set:
- `$GOPATH`
- `$PATH`: should include `$GOPATH/bin`, `$GOROOT/bin` and the location of `qmake` and `rcc`

Clone this repository to `$GOPATH/src/github.com/digitalbitbox/bitbox-wallet-app` (`$GOPATH` is usually `~/go`).

To initialize the build environment and install the required go utilities (linters, ...), call
* `make envinit`, or
* on MacOS `make osx-init`

## Build the BitBoxApp

Please consult `docs/BUILD.md` for platform specific instructions and further
information.

## I18N translation workflow

Please consult `docs/i18n.md`.

## Electrum server backend

The servers used are configurable in the app settings. Currently, when running the app in devmode
(`make servewallet`), the config is ignored and servers on Shift's devserver are used. The
hosts/ports/certs of those are currently hardcoded.

Currently, [Electrs](https://github.com/romanz/electrs) is the recommended way to connect your own
full node. ElectrumX is currently not supported, see [this
issue](https://github.com/digitalbitbox/bitbox-wallet-app/issues/499).

## Development workflow

### Local development

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

#### Go dependencies

Go dependencies are managed by `go mod`, and vendored using `make go-vendor`. The deps are vendored
so that

- offline builds work
- dependency diffs are easier to inspect
- less reliance on remote systems
- because `gomobile bind` does not support Go modules yet

#### Update npm dependencies

Check outdated dependencies `cd frontends/web && yarn outdated` and `yarn upgrade
modulename@specificversion`.

### CI

Run `make ci` to run all static analysis tools and tests.

### Build the UI

To statically compile the UI, run `make buildweb` again, which compiles the web ui into a compact
bundle.

### Base integration
To test the BitBox Base integration, run the base-middleware on your local
machine. Make sure you have bitcoind and c-lightning running as well.

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
