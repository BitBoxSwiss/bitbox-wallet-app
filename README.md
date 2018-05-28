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
- `vendor/`: Go dependencies, managed by the `dep` tool (see the Requirements section below).
- `electrum/`: A json rpc client library, talking to Electrum servers.
- `devices/bitbox/`: Library to detect and talk to digital bitboxes. High level API access.
- `coins/btc/`: Local HD wallet, sourcing blockchain index from an arbitrary
  backend. Manages addresses, outputs, tx creation, and everything else that a wallet needs to do.
- `backend/`: The library that ties it all together. Uses the above packages to create a wallet talking
  Electrum using the DBB for signing, and serve a high level HTTP API to control it.
- `frontends/qt/`: the C++/Qt5 app which builds the wallet app for the desktop.
- `frontends/web/`: home of the preact UI.

## Set up the development environment

The below instructions assume a unix environment.

### Requirements

- [Go](https://golang.org/doc/install) version 1.9.2.
- [Yarn](https://yarnpkg.com/en/) - for managing the web UI deps.
- [Qt5](https://www.qt.io)
  - Install on OSX: `brew install qt5 && brew link qt5`

Make sure $GOPATH is set and $GOPAH/bin is in your $PATH

Clone/move this repo to `$GOPATH/src/github.com/shiftdevices/godbb` (`$GOPATH` is usually `~/go`).

Only the first time, set up the project with `make init`.

## ElectrumX Backend

We run ElectrumX backends on a devserver. The host/ports are currently hardcoded. Below is the
reference for how they are deployed.

The Bitcoin node needs to be synced with the following settings (`.bitcoin/bitcoin.conf`):

```
testnet=1
rpcuser=<rpcuser>
rpcpassword=<rpcpassword>
txindex=1
```

ElectrumX can can be run like this (similar settings for mainnet and other coins):

```sh
docker run -v /home/<user>/.electrumx-btc-testnet:/data -e DAEMON_URL="<rpcuser>:<rpspassword>@<host-ip>:18332" -e COIN=BitcoinSegwit -e NET=testnet -e RPC_PORT=18002 -e PEER_DISCOVERY= -e HOST=0.0.0.0 -e RPC_HOST=0.0.0.0 -e TCP_PORT=51001 -e SSL_PORT=51002 -e SSL_CERTFILE="/data/btc_testnet.cert.pem" -e SSL_KEYFILE="/data/btc_testnet_plain.key.pem" -p 51002:51002 -p 18002:18002 lukechilds/electrumx
```

`<host-ip>` should be the IP of your machine (check `ip addr`), not `localhost`, as that refers to
the docker image.

We are currently using our development server to host the ElectrumX servers. Running your own node
would require that you change the TLS root certificate currently located under
`config/certificates/electrumx/dev/ca.cert.pem`.

Additionally, you have to create a new `assets.go` file in the `coins/btc/electrum` directory. You can do so by changing into
the directory and executing:
```
go-bindata -o assets.go -pkg electrum ../../../config/certificates/electrumx/dev/ca.cert.pem
```

However, to save you the effort, we recommend to not host your own ElectrumX servers.

The godbb app connects to the server `dev.shiftcrypto.ch`, which at the moment, requires that you add the following line to your `/etc/hosts` file:

```
176.9.28.202	dev.shiftcrypto.ch
```

## Development Workflow


### Local Development

Run `make servewallet` and `make webdev` in seperate terminals (screen or tmux recommended!),

#### Watch and build the UI

Run `make webdev` to develop the UI inside Chromium (for quick development, automatic rebuilds
and devtools). This serves the UI on [localhost:8080](http://localhost:8080). Changes to the web
code in  `frontends/web/src` are automatically detected and rebuilt.

#### Run the HTTP API

Run `make servewallet` to compile the code and run `servewallet`. `servewallet` is a
devtool which serves the HTTP API.

#### Update go dependencies

Run `dep ensure` to update dependencies.

### Production build

To build the standalone desktop app, run `make qt`.

### CI

Run `make ci` to run all static analysis tools and tests.

### Build the UI

To statically compile the UI, run `make generate` again, which compiles the web ui into a compact
bundle.

Go will then compile the bundle into the static static library/binary. This step only needs
to be done before compiling for deployment. You can check the result by running `make servewallet`
and visiting [localhost:8082](http://localhost:8082), which is the port on which it serves the
static content.


## Develop using Docker

The Dockerfile provides a Ubuntu container with the whole environment preconfigured. To set it up,
run `make dockerinit`, which builds the Docker image (this takes a while).

After that, `make dockerdev` enters the container (a shell inside an Ubuntu virtual machine), where
you can perform the same steps as in the previous section (`make servewallet` and `make
webdev`). Running `make dockerdev` multiple times shares the same container. You can edit the code
in your usual editor in the host and compile inside the container.

For the first time after `make dockerinit`, enter the image with `make dockerdev` and run `make
init` to initialize the repo.

To execute `make servewallet/webdev` insider the container, but from the host, use this:

`$ ./scripts/docker_exec.sh servewallet/webdev`
