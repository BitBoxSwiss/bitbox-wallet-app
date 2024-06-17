module github.com/BitBoxSwiss/bitbox-wallet-app

go 1.21

require (
	github.com/BitBoxSwiss/bitbox02-api-go v0.0.0-20240531104813-fa7f932bdd38
	github.com/BitBoxSwiss/block-client-go v0.0.0-20240516081043-0d604acd6519
	github.com/btcsuite/btcd v0.24.0
	github.com/btcsuite/btcd/btcec/v2 v2.3.3
	github.com/btcsuite/btcd/btcutil v1.1.5
	github.com/btcsuite/btcd/chaincfg/chainhash v1.1.0
	github.com/ethereum/go-ethereum v1.14.5
	github.com/flynn/noise v1.1.0
	github.com/gorilla/mux v1.8.1
	github.com/gorilla/websocket v1.5.3
	github.com/karalabe/hid v1.0.1-0.20240306101548-573246063e52
	github.com/pkg/errors v0.9.1
	github.com/sirupsen/logrus v1.9.3
	github.com/skip2/go-qrcode v0.0.0-20200617195104-da1b6568686e
	github.com/stretchr/testify v1.9.0
	go.etcd.io/bbolt v1.3.10
	golang.org/x/crypto v0.24.0
	golang.org/x/net v0.26.0
)

// TODO: remove once https://github.com/karalabe/hid/pull/52 is merged.
replace github.com/karalabe/hid => github.com/benma/hid v0.0.0-20240312170000-f050ee197113

require (
	github.com/Microsoft/go-winio v0.6.2 // indirect
	github.com/aead/siphash v1.0.1 // indirect
	github.com/bits-and-blooms/bitset v1.13.0 // indirect
	github.com/btcsuite/btclog v0.0.0-20170628155309-84c8d2346e9f // indirect
	github.com/cespare/cp v1.1.1 // indirect
	github.com/consensys/bavard v0.1.13 // indirect
	github.com/consensys/gnark-crypto v0.12.1 // indirect
	github.com/crate-crypto/go-kzg-4844 v1.0.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/deckarep/golang-set/v2 v2.6.0 // indirect
	github.com/decred/dcrd/crypto/blake256 v1.0.1 // indirect
	github.com/decred/dcrd/dcrec/secp256k1/v4 v4.3.0 // indirect
	github.com/ethereum/c-kzg-4844 v1.0.2 // indirect
	github.com/fsnotify/fsnotify v1.7.0 // indirect
	github.com/go-ole/go-ole v1.3.0 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/holiman/uint256 v1.2.4 // indirect
	github.com/kkdai/bstream v1.0.0 // indirect
	github.com/mmcloughlin/addchain v0.4.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/shirou/gopsutil v3.21.11+incompatible // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/supranational/blst v0.3.12 // indirect
	github.com/tklauser/go-sysconf v0.3.14 // indirect
	github.com/tklauser/numcpus v0.8.0 // indirect
	github.com/yusufpapurcu/wmi v1.2.4 // indirect
	golang.org/x/exp v0.0.0-20240604190554-fc45aab8b7f8 // indirect
	golang.org/x/sync v0.7.0 // indirect
	golang.org/x/sys v0.21.0 // indirect
	google.golang.org/protobuf v1.34.1 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	rsc.io/tmplfunc v0.0.3 // indirect
)
