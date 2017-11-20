# godbb

This repo contains the source code for the Digital Bitbox wallet and related tools.

## Tech Stack

The wallet UI is a [preact](https://preactjs.com/) single page webapp. It sources its data from a
HTTP server (regular data endpoints and websockets, as well as the static assets).

Go is used for all the backend code, and for creating a local webserver to serve the UI. The UI
assets (html, js, css, images, ...) are also statically built in.

The Go library is compiled as a static C library which exposes one function only: `serve()`, which,
when called, spins up a local webserver that serves the assets and the API.

The Desktop app is a static C++ Qt5 program containing only a `WebEngineView`, displaying the UI.

Similarly to the Desktop variant, the Go library can be statically compiled and added to an Android
Studio / XCode project. This is not part of this repo yet.

## Directories (subject to change)

- `cmd/`: Go projects which generate binaries are here.
- `cmd/servewallet/`: a development aid which serves the static web ui and the http api it talks
  to. See below.
- `vendor/`: Go dependencies, managed by the `dep` tool (see the Development section below).
- `electrum/`: A json rpc client library, talking to Electrum servers.
- `dbbdevice/`: Library to detect and talk to digital bitboxes. High level API access.
- `deterministicwallet/`: Local HD wallet, sourcing blockchain index from an arbitary
  backend. Manages addresses, outputs, tx creation, and everything else that a wallet needs to do.
- `knot/`: The library that ties it all together. Uses the above packages to create a wallet talking
  Electrum using the DBB for signing, and serve a high level HTTP API to control it.
- `frontends/qt/`: the C++/Qt5 app which builds the wallet app for the desktop.
- `frontends/web/`: home of the preact UI.

## Set up the development environment

The below instructions assume a unix environment.

I plan to add a Dockerfile, so the following steps don't have to be repeated by every
developer. Until that time:

### Requirements

- [Go](https://golang.org/doc/install) version 1.9.2.
- [Go dep](https://github.com/golang/dep) - for managing Go deps.
  - Install with `go get -u github.com/golang/dep/cmd/dep`.
- [goimports](https://godoc.org/golang.org/x/tools/cmd/goimports) - integrate with your editor to
  automatically format the code and import packages.
- [Yarn](https://yarnpkg.com/en/) - for managing the web UI deps.

Clone/move this repo to `$GOPATH/src/github.com/shiftdevices/godbb` (`$GOPATH` is usually `~/go`).

In the project root, run `make init`.

## Electrum Bitcoin Testnet Backend

At the moment, `localhost:51001` is hardcoded for the Electrum backend. Sync `bitcoind -testnet` and
run [ElectrumX](https://github.com/kyuupichan/electrumx/) like this:


```sh
RPC_PORT=8002 PEER_DISCOVERY= TCP_PORT=51001 DB_DIRECTORY=~/.electrumx-testnet DAEMON_URL="<rpcuser>:<rpcwassword>@127.0.0.1" COIN=BitcoinSegwit NET=testnet /path/to/electrumx_server.py
```

The .bitcoin/bitcoin.conf should have txindex enabled:

```
rpcuser=<rpcuser>
rpcpassword=<rpcpassword>
txindex=1
```

See the [Electrumx HowTo](https://github.com/kyuupichan/electrumx/blob/master/docs/HOWTO.rst).

## Development Workflow

I develop the UI inside Chromium, for quick development and its devtools, even if the final app is
compiled into a standalone app.

To do this, I run `make servewallet` to compile the code and run `servewallet`. `servewallet` is a
devtool which serves the HTTP API.

In a different terminal, I run `make webdev` to serve the UI on
[localhost:8080](http://localhost:8080). Changes to the web code in `frontends/web/` is
automatically reloaded by this, also for quick development.

To statically compile the UI, run `make generate` again, which compiles the web ui into a compact
bundle. Go will then compile the bundle into the static static library/binary. This step only needs
to be done before compiling for deployment. You can check the result by running `make servewallet`
and visiting [localhost:8082](http://localhost:8082), which is the port on which it serves the
static content.

To build the standalone desktop app, run `make qt`.
