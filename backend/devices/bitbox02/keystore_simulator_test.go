// Copyright 2025 Shift Crypto AG
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build bitbox02_simulator
// +build bitbox02_simulator

package bitbox02

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/addresses"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/blockchain"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/maketx"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/ltc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/logging"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/socksproxy"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/common"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/mocks"
	"github.com/BitBoxSwiss/bitbox02-api-go/communication/u2fhid"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/wire"
	"github.com/ethereum/go-ethereum/params"
	"github.com/stretchr/testify/require"
)

var (
	log     = logging.Get().WithGroup("simulator tx signing test")
	network = &chaincfg.MainNetParams
	coinBTC = btc.NewCoin(coinpkg.CodeBTC, "Bitcoin", "BTC", coinpkg.BtcUnitDefault, network, ".", []*config.ServerInfo{}, "https://blockstream.info/testnet/tx/", socksproxy.NewSocksProxy(false, ""))
	coinLTC = btc.NewCoin(coinpkg.CodeLTC, "Litecoin", "LTC", coinpkg.BtcUnitDefault, &ltc.MainNetParams, ".", []*config.ServerInfo{}, "", socksproxy.NewSocksProxy(false, ""))
	coinETH = eth.NewCoin(nil, "Etheruem", "ETH", "ETH", "ETH", params.MainnetChainConfig, "", nil, nil)
)

func mustKeypath(keypath string) signing.AbsoluteKeypath {
	kp, err := signing.NewAbsoluteKeypath(keypath)
	if err != nil {
		panic(err)
	}
	return kp
}

func mustOutpoint(s string) *wire.OutPoint {
	outPoint, err := wire.NewOutPointFromString(s)
	if err != nil {
		panic(err)
	}
	return outPoint
}

func runSimulator(filename string) (func() error, *Device, *bytes.Buffer, error) {
	//
	cmd := exec.Command("stdbuf", "-oL", filename)

	// Create pipe before starting process
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, nil, nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, nil, nil, err
	}

	var stdoutBuf bytes.Buffer
	scanner := bufio.NewScanner(stdout)
	go func() {
		for scanner.Scan() {
			stdoutBuf.Write(scanner.Bytes())
			stdoutBuf.WriteByte('\n')
		}
	}()

	var conn net.Conn
	for range 200 {
		conn, err = net.Dial("tcp", "localhost:15423")
		if err == nil {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if err != nil {
		return nil, nil, nil, err
	}
	const bitboxCMD = 0x80 + 0x40 + 0x01

	communication := u2fhid.NewCommunication(conn, bitboxCMD)
	match := regexp.MustCompile(`v([0-9]+\.[0-9]+\.[0-9]+)`).FindStringSubmatch(filename)
	if len(match) != 2 {
		return nil, nil, nil, errp.New("could not find simulator firmware version")
	}
	version, err := semver.NewSemVerFromString(match[1])
	if err != nil {
		return nil, nil, nil, err
	}
	device := NewDevice("ID", version, common.ProductBitBox02Multi,
		&mocks.Config{}, communication,
	)
	return func() error {
		if err := conn.Close(); err != nil {
			return err
		}
		if err := cmd.Process.Kill(); err != nil {
			return err
		}
		_, err := cmd.Process.Wait()
		return err
	}, device, &stdoutBuf, nil
}

// Download BitBox simulators based on testdata/simulators.json to testdata/simulators/*.
// Skips the download if the file already exists and has the corect hash.
func downloadSimulators() ([]string, error) {
	type simulator struct {
		URL    string `json:"url"`
		Sha256 string `json:"sha256"`
	}
	data, err := os.ReadFile("./testdata/simulators.json")
	if err != nil {
		return nil, err
	}
	var simulators []simulator
	if err := json.Unmarshal(data, &simulators); err != nil {
		return nil, err
	}

	hashesMatch := func(file *os.File, expectedHash string) (bool, error) {
		hasher := sha256.New()
		if _, err := io.Copy(hasher, file); err != nil {
			return false, err
		}
		actualHash := hex.EncodeToString(hasher.Sum(nil))
		return actualHash == expectedHash, nil
	}

	fileNotExistOrHashMismatch := func(filename, expectedHash string) (bool, error) {
		file, err := os.Open(filename)
		if os.IsNotExist(err) {
			return true, nil
		}
		if err != nil {
			return false, err
		}
		defer file.Close()

		match, err := hashesMatch(file, expectedHash)
		if err != nil {
			return false, err
		}
		return !match, nil
	}

	downloadFile := func(url, filename string) error {
		resp, err := http.Get(url)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("bad status: %s", resp.Status)
		}

		// Create the file
		out, err := os.Create(filename)
		if err != nil {
			return err
		}
		defer out.Close()

		_, err = io.Copy(out, resp.Body)
		return err
	}
	filenames := []string{}
	for _, simulator := range simulators {
		simUrl, err := url.Parse(simulator.URL)
		if err != nil {
			return nil, err
		}
		filename := filepath.Join("testdata", "simulators", path.Base(simUrl.Path))
		if err := os.MkdirAll(filepath.Dir(filename), 0755); err != nil {
			return nil, err
		}
		doDownload, err := fileNotExistOrHashMismatch(filename, simulator.Sha256)
		if err != nil {
			return nil, err
		}
		if doDownload {
			fmt.Printf("Downloading %s to %s\n", simulator.URL, filename)
			if err := downloadFile(simulator.URL, filename); err != nil {
				return nil, err
			}
			// If we downloaded the file, check again the hash.
			file, err := os.Open(filename)
			if err != nil {
				// This should never happen, as we just downloaded it
				return nil, err
			}
			match, err := hashesMatch(file, simulator.Sha256)
			if err != nil {
				return nil, err
			}
			if !match {
				return nil, errp.Newf("downloaded file %s does not match expected hash %s", filename, simulator.Sha256)
			}
			if err := os.Chmod(filename, 0755); err != nil {
				return nil, err
			}
		} else {
			fmt.Printf("Skipping download of %s, file %s already exists and has the correct hash\n", simulator.URL, filename)
		}

		filenames = append(filenames, filename)
	}
	return filenames, nil
}

var downloadSimulatorsOnce = sync.OnceValues(downloadSimulators)

// Runs tests against a simulator which is not initialized (not paired, not seeded).
func testSimulators(t *testing.T, run func(*testing.T, *Device, *bytes.Buffer)) {
	t.Helper()
	if runtime.GOOS != "linux" || runtime.GOARCH != "amd64" {
		t.Skip("Skipping simulator tests: not running on linux-amd64")
	}

	var simulatorFilenames []string
	envSimulator := os.Getenv("SIMULATOR")
	if envSimulator != "" {
		simulatorFilenames = []string{envSimulator}
	} else {
		var err error
		simulatorFilenames, err = downloadSimulatorsOnce()
		require.NoError(t, err)
	}

	for _, simulatorFilename := range simulatorFilenames {
		t.Run(filepath.Base(simulatorFilename), func(t *testing.T) {
			teardown, device, stdOut, err := runSimulator(simulatorFilename)
			require.NoError(t, err)
			defer func() { require.NoError(t, teardown()) }()
			run(t, device, stdOut)
		})
	}
}

// Runs tests against a simulator which is not initialized, but paired (not seeded).
func testSimulatorsAfterPairing(t *testing.T, run func(*testing.T, *Device, *bytes.Buffer)) {
	t.Helper()
	testSimulators(t, func(t *testing.T, device *Device, stdOut *bytes.Buffer) {
		t.Helper()
		paired := make(chan struct{})
		device.Observe(func(event observable.Event) {
			if event.Subject == string(firmware.EventChannelHashChanged) {
				_, deviceVerified := device.ChannelHash()
				if deviceVerified {
					// Accept pairing.
					device.ChannelHashVerify(true)
					// Unblock
					close(paired)
				}
			}
		})
		require.NoError(t, device.Init(true))
		select {
		case <-paired:
		case <-time.After(15 * time.Second):
			require.Fail(t, "pairing timed out")
		}
		run(t, device, stdOut)
	})
}

// Runs tests againt a simulator that is seeded with this mnemonic: boring mistake dish oyster truth
// pigeon viable emerge sort crash wire portion cannon couple enact box walk height pull today solid
// off enable tide
func testInitializedSimulators(t *testing.T, run func(*testing.T, *Device, *bytes.Buffer)) {
	t.Helper()
	testSimulatorsAfterPairing(t, func(t *testing.T, device *Device, stdOut *bytes.Buffer) {
		t.Helper()
		require.NoError(t, device.RestoreFromMnemonic())
		run(t, device, stdOut)
	})
}

func TestSimulatorRootFingerprint(t *testing.T) {
	testInitializedSimulators(t, func(t *testing.T, device *Device, stdOut *bytes.Buffer) {
		t.Helper()
		fp, err := device.Keystore().RootFingerprint()
		require.NoError(t, err)
		require.Equal(t, "4c00739d", hex.EncodeToString(fp))
	})
}

func TestSimulatorExtendedPublicKeyBTC(t *testing.T) {
	testInitializedSimulators(t, func(t *testing.T, device *Device, stdOut *bytes.Buffer) {
		t.Helper()
		keypath := mustKeypath("m/84'/1'/0'")
		xpub, err := device.Keystore().ExtendedPublicKey(coinBTC, keypath)
		require.NoError(t, err)
		require.Equal(t,
			"xpub6CAkM5q77qFTdrsoqguwTxAnnPVRd4hyHntZaYr9FTcefWi3AaTevG1YTvWzkNuqtshjQnJxpw1YjKLtuQvfvDiDiLVx2XYKZW5baGsRUuC",
			xpub.String(),
		)
	})
}

func makeConfig(t *testing.T, device *Device, scriptType signing.ScriptType, keypath signing.AbsoluteKeypath) *signing.Configuration {
	t.Helper()
	xpubStr, err := device.BTCXPub(messages.BTCCoin_BTC, keypath.ToUInt32(), messages.BTCPubRequest_XPUB, false)
	require.NoError(t, err)
	xpub, err := hdkeychain.NewKeyFromString(xpubStr)
	require.NoError(t, err)
	rootFingerprint := []byte{1, 2, 3, 4}
	return signing.NewBitcoinConfiguration(scriptType, rootFingerprint, keypath, xpub)
}

func makeTx(t *testing.T, device *Device, recipient *maketx.OutputInfo) *btc.ProposedTransaction {
	t.Helper()

	configurations := []*signing.Configuration{
		makeConfig(t, device, signing.ScriptTypeP2TR, mustKeypath("m/86'/0'/0'")),
		makeConfig(t, device, signing.ScriptTypeP2WPKH, mustKeypath("m/84'/0'/0'")),
		makeConfig(t, device, signing.ScriptTypeP2WPKHP2SH, mustKeypath("m/49'/0'/0'")),
		makeConfig(t, device, signing.ScriptTypeP2WPKH, mustKeypath("m/84'/0'/1'")),
	}
	inputAddress0 := addresses.NewAccountAddress(configurations[0], types.Derivation{Change: false, AddressIndex: 0}, network, log)
	inputAddress1 := addresses.NewAccountAddress(configurations[1], types.Derivation{Change: false, AddressIndex: 0}, network, log)
	inputAddress2 := addresses.NewAccountAddress(configurations[2], types.Derivation{Change: false, AddressIndex: 0}, network, log)
	changeAddress := addresses.NewAccountAddress(configurations[0], types.Derivation{Change: true, AddressIndex: 1}, network, log)

	inputAddress3 := addresses.NewAccountAddress(configurations[3], types.Derivation{Change: false, AddressIndex: 0}, network, log)

	prevTx := &wire.MsgTx{
		Version: 2,
		TxIn: []*wire.TxIn{
			{
				PreviousOutPoint: *mustOutpoint("3131313131313131313131313131313131313131313131313131313131313131:0"),
				Sequence:         0xFFFFFFFF,
			},
		},
		TxOut: []*wire.TxOut{
			{
				Value: 100_000_000,
				PkScript: func() []byte {
					return inputAddress0.PubkeyScript()

				}(),
			},
			{
				Value: 100_000_000,
				PkScript: func() []byte {
					return inputAddress1.PubkeyScript()
				}(),
			},
			{
				Value: 100_000_000,
				PkScript: func() []byte {
					return inputAddress2.PubkeyScript()
				}(),
			},
		},
		LockTime: 0,
	}
	prevTxHash := prevTx.TxHash()

	addrs := []*addresses.AccountAddress{
		inputAddress0,
		inputAddress1,
		inputAddress2,
		changeAddress,
	}

	addrsInDifferentAccount := []*addresses.AccountAddress{
		inputAddress3,
	}

	spendableOutputs := map[wire.OutPoint]maketx.UTXO{
		*wire.NewOutPoint(&prevTxHash, 0): maketx.UTXO{prevTx.TxOut[0], inputAddress0},
		*wire.NewOutPoint(&prevTxHash, 1): maketx.UTXO{prevTx.TxOut[1], inputAddress1},
		*wire.NewOutPoint(&prevTxHash, 2): maketx.UTXO{prevTx.TxOut[2], inputAddress2},
	}
	outputAmount := int64(250_000_000)
	feePerKb := btcutil.Amount(1000)
	txProposal, err := maketx.NewTx(
		coinBTC,
		spendableOutputs,
		recipient,
		outputAmount,
		feePerKb,
		changeAddress,
		log,
	)
	require.NoError(t, err)

	return &btc.ProposedTransaction{
		TXProposal:                   txProposal,
		AccountSigningConfigurations: configurations,
		GetPrevTx: func(chainhash.Hash) (*wire.MsgTx, error) {
			return prevTx, nil
		},
		GetKeystoreAddress: func(account *btc.Account, scriptHashHex blockchain.ScriptHashHex) (*addresses.AccountAddress, bool, error) {
			for _, address := range addrs {
				if address.PubkeyScriptHashHex() == scriptHashHex {
					return address, true, nil
				}
			}
			for _, address := range addrsInDifferentAccount {
				if address.PubkeyScriptHashHex() == scriptHashHex {
					return address, false, nil
				}
			}
			return nil, false, nil
		},
		Signatures: make([]*types.Signature, len(txProposal.Transaction.TxIn)),
		FormatUnit: coinpkg.BtcUnitDefault,
	}

}

func TestSimulatorSignBTCTransactionSendSelfDifferentAccount(t *testing.T) {
	testInitializedSimulators(t, func(t *testing.T, device *Device, stdOut *bytes.Buffer) {
		t.Helper()

		cfg := makeConfig(t, device, signing.ScriptTypeP2WPKH, mustKeypath("m/84'/0'/1'"))
		selfAddress := addresses.NewAccountAddress(
			cfg,
			types.Derivation{Change: false, AddressIndex: 0},
			network,
			log)
		proposedTransaction := makeTx(t, device, maketx.NewOutputInfo(selfAddress.PubkeyScript()))

		require.NoError(t, device.Keystore().SignTransaction(proposedTransaction))
		require.NoError(t, proposedTransaction.Finalize())
		require.NoError(
			t,
			btc.TxValidityCheck(
				proposedTransaction.TXProposal.Transaction,
				proposedTransaction.TXProposal.PreviousOutputs,
				proposedTransaction.TXProposal.SigHashes()))

		// Send-to-self message from different accounts is only available on v9.22 and later.
		if device.Version().AtLeast(semver.NewSemVer(9, 22, 0)) {
			require.Contains(t, stdOut.String(), "ADDRESS: This BitBox (account #2): bc1qeunlpt8umlyyv0mpzpe3uauqlezsh39ctwg4e5")
		} else if device.Version().AtLeast(semver.NewSemVer(9, 20, 0)) {
			require.Contains(t, stdOut.String(), "ADDRESS: bc1qeunlpt8umlyyv0mpzpe3uauqlezsh39ctwg4e5")
		}
	})
}

func TestSimulatorSignBTCTransactionMixedInputs(t *testing.T) {
	testInitializedSimulators(t, func(t *testing.T, device *Device, stdOut *bytes.Buffer) {
		t.Helper()

		pkScript, err := hex.DecodeString("76a91455ae51684c43435da751ac8d2173b2652eb6410588ac")
		require.NoError(t, err)
		proposedTransaction := makeTx(t, device, maketx.NewOutputInfo(pkScript))

		require.NoError(t, device.Keystore().SignTransaction(proposedTransaction))
		require.NoError(t, proposedTransaction.Finalize())
		require.NoError(
			t,
			btc.TxValidityCheck(
				proposedTransaction.TXProposal.Transaction,
				proposedTransaction.TXProposal.PreviousOutputs,
				proposedTransaction.TXProposal.SigHashes()))

		// Before simulator v9.20, address confirmation data was not written to stdout.
		if device.Version().AtLeast(semver.NewSemVer(9, 20, 0)) {
			require.Contains(t, stdOut.String(), "ADDRESS: 18p3G8gQ3oKy4U9EqnWs7UZswdqAMhE3r8")
		}
	})
}

func TestSimulatorSignBTCTransactionSendSelfSameAccount(t *testing.T) {
	testInitializedSimulators(t, func(t *testing.T, device *Device, stdOut *bytes.Buffer) {
		t.Helper()

		cfg := makeConfig(t, device, signing.ScriptTypeP2TR, mustKeypath("m/86'/0'/0'"))
		selfAddress := addresses.NewAccountAddress(
			cfg,
			types.Derivation{Change: false, AddressIndex: 0},
			network,
			log)
		proposedTransaction := makeTx(t, device, maketx.NewOutputInfo(selfAddress.PubkeyScript()))

		require.NoError(t, device.Keystore().SignTransaction(proposedTransaction))
		require.NoError(t, proposedTransaction.Finalize())
		require.NoError(
			t,
			btc.TxValidityCheck(
				proposedTransaction.TXProposal.Transaction,
				proposedTransaction.TXProposal.PreviousOutputs,
				proposedTransaction.TXProposal.SigHashes()))

		// v9.22 changed the format of the output string.
		if device.Version().AtLeast(semver.NewSemVer(9, 22, 0)) {
			require.Contains(t, stdOut.String(), "ADDRESS: This BitBox (same account): bc1pg848p0rvmj0r3j064prlpw0gecyzkwlpt7ndzdlmh2mvkyu299psetgxhf")
		} else if device.Version().AtLeast(semver.NewSemVer(9, 20, 0)) {
			// Before simulator v9.20, address confirmation data was not written to stdout.
			require.Contains(t, stdOut.String(), "ADDRESS: This BitBox02: bc1pg848p0rvmj0r3j064prlpw0gecyzkwlpt7ndzdlmh2mvkyu299psetgxhf")
		}
	})
}

func TestSimulatorSignBTCTransactionSilentPayment(t *testing.T) {
	testInitializedSimulators(t, func(t *testing.T, device *Device, stdOut *bytes.Buffer) {
		t.Helper()

		proposedTransaction := makeTx(t, device,
			maketx.NewOutputInfoSilentPayment("sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj85c6qdfhjdpdjtdgqjuexzk6murw56suy3e0rd2cgqvycxttddwsvgxe2usfpxumr70xc9pkqwv"))

		if !device.Version().AtLeast(semver.NewSemVer(9, 21, 0)) {
			require.EqualError(t,
				device.Keystore().SignTransaction(proposedTransaction),
				firmware.UnsupportedError("9.21.0").Error(),
			)
			return
		}

		require.NoError(t, device.Keystore().SignTransaction(proposedTransaction))
		require.NoError(t, proposedTransaction.Finalize())
		require.NoError(
			t,
			btc.TxValidityCheck(
				proposedTransaction.TXProposal.Transaction,
				proposedTransaction.TXProposal.PreviousOutputs,
				proposedTransaction.TXProposal.SigHashes()))

		found := false
		expectedSilentPaymentOutputPkScript := "5120d826829cb603fc008e5ef99d0818f2126d3569c3ab8a6cd069f07a20e892bd59"
		for _, o := range proposedTransaction.TXProposal.Transaction.TxOut {
			if hex.EncodeToString(o.PkScript) == expectedSilentPaymentOutputPkScript {
				found = true
				break
			}
		}
		require.True(t, found)
	})
}

func TestSimulatorVerifyAddressBTC(t *testing.T) {
	testInitializedSimulators(t, func(t *testing.T, device *Device, stdOut *bytes.Buffer) {
		t.Helper()

		type test struct {
			coin                 coinpkg.Coin
			accountConfiguration *signing.Configuration
			derivation           types.Derivation
			expectedAddress      string
		}
		tests := []test{
			{
				coin:                 coinBTC,
				accountConfiguration: makeConfig(t, device, signing.ScriptTypeP2TR, mustKeypath("m/86'/0'/0'")),
				derivation:           types.Derivation{Change: false, AddressIndex: 0},
				expectedAddress:      "bc1pg848p0rvmj0r3j064prlpw0gecyzkwlpt7ndzdlmh2mvkyu299psetgxhf",
			},
			{
				coin:                 coinBTC,
				accountConfiguration: makeConfig(t, device, signing.ScriptTypeP2TR, mustKeypath("m/86'/0'/0'")),
				derivation:           types.Derivation{Change: true, AddressIndex: 10},
				expectedAddress:      "bc1pru6697hz78fxc7dvz36qvgkne59kht86eyk7cefc6hpvgud4z76qxjc8we",
			},
			{
				coin:                 coinBTC,
				accountConfiguration: makeConfig(t, device, signing.ScriptTypeP2WPKH, mustKeypath("m/84'/0'/0'")),
				derivation:           types.Derivation{Change: false, AddressIndex: 0},
				expectedAddress:      "bc1qljxfdh29amtq6u2xgltc0e6d9vemtt5m6mc5nd",
			},
			{
				coin:                 coinBTC,
				accountConfiguration: makeConfig(t, device, signing.ScriptTypeP2WPKHP2SH, mustKeypath("m/49'/0'/0'")),
				derivation:           types.Derivation{Change: false, AddressIndex: 0},
				expectedAddress:      "3PSdXEXzzmqVXSV6DECyaaaaDYVyaHQ8AD",
			},
		}
		if device.Version().AtLeast(semver.NewSemVer(9, 23, 0)) {
			// Litecoin was not enabled in the simulator before v9.23.0.
			tests = append(tests,
				test{
					coin:                 coinLTC,
					accountConfiguration: makeConfig(t, device, signing.ScriptTypeP2WPKH, mustKeypath("m/84'/2'/0'")),
					derivation:           types.Derivation{Change: false, AddressIndex: 0},
					expectedAddress:      "ltc1qmgh3jwrt636mya08dytcsm7gxsxva8ckcu93jm",
				},
				test{
					coin:                 coinLTC,
					accountConfiguration: makeConfig(t, device, signing.ScriptTypeP2WPKHP2SH, mustKeypath("m/49'/2'/0'")),
					derivation:           types.Derivation{Change: false, AddressIndex: 0},
					expectedAddress:      "MFbeAVCwWdVvi5SeZh4zTpyz2gfPFdhs9c",
				},
			)
		}

		for _, test := range tests {
			stdOut.Truncate(0)
			require.NoError(t, device.Keystore().VerifyAddressBTC(
				test.accountConfiguration,
				test.derivation,
				test.coin))
			require.Eventually(t,
				func() bool {
					return strings.Contains(
						stdOut.String(),
						fmt.Sprintf(
							"CONFIRM SCREEN START\nTITLE: %s\nBODY: %s\nCONFIRM SCREEN END\n",
							test.coin.Name(), test.expectedAddress))
				},
				time.Second, 10*time.Millisecond)
		}
	})
}

func TestSimulatorVerifyAddressETH(t *testing.T) {
	testInitializedSimulators(t, func(t *testing.T, device *Device, stdOut *bytes.Buffer) {
		t.Helper()

		type test struct {
			keypath         signing.AbsoluteKeypath
			expectedAddress string
		}

		tests := []test{
			{
				keypath:         mustKeypath("m/44'/60'/0'/0/0"),
				expectedAddress: "0x416E88840Eb6353E49252Da2a2c140eA1f969D1a",
			},
			{
				keypath:         mustKeypath("m/44'/60'/0'/0/1"),
				expectedAddress: "0x6A2A567cB891DeF8eA8C215C85f93d2f0F844ceB",
			},
		}

		for _, test := range tests {
			xpub, err := device.Keystore().ExtendedPublicKey(coinETH, test.keypath)
			require.NoError(t, err)
			stdOut.Truncate(0)

			addressConfiguration := signing.NewEthereumConfiguration(
				[]byte{1, 2, 3, 4}, test.keypath, xpub)

			require.NoError(t, device.Keystore().VerifyAddressETH(addressConfiguration, coinETH))
			require.Eventually(t,
				func() bool {
					return strings.Contains(
						stdOut.String(),
						fmt.Sprintf(
							"CONFIRM SCREEN START\nTITLE: Ethereum\nBODY: %s\nCONFIRM SCREEN END\n",
							test.expectedAddress))
				},
				time.Second, 10*time.Millisecond)
		}
	})
}
