// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	backendPkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/electrum"
	btcHeaders "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/headers"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/block-client-go/electrum/types"
	"github.com/sirupsen/logrus"
	"golang.org/x/net/proxy"
)

func fetchTipCheckpoint(ctx context.Context, code coinpkg.Code, log *logrus.Entry) (int, string, error) {
	serverInfos := backendPkg.DefaultDevServers(code)
	if len(serverInfos) == 0 {
		return 0, "", errp.Newf("no dev servers for %s", code)
	}

	client := electrum.NewElectrumConnection(serverInfos, log, proxy.Direct)
	defer client.Close()

	heightChan := make(chan int, 1)
	client.HeadersSubscribe(func(header *types.Header) {
		select {
		case heightChan <- header.Height:
		default:
		}
	})

	var height int
	select {
	case height = <-heightChan:
	case <-ctx.Done():
		return 0, "", errp.WithMessage(ctx.Err(), "timeout waiting for headers subscription")
	}

	headersResult, err := client.Headers(height, 1)
	if err != nil {
		return 0, "", err
	}
	if len(headersResult.Headers) != 1 {
		return 0, "", errp.Newf("expected 1 header, got %d", len(headersResult.Headers))
	}
	hash := headersResult.Headers[0].BlockHash().String()
	return height, hash, nil
}

func writeFileAtomic(filename string, data []byte) error {
	dir := filepath.Dir(filename)
	tmp, err := os.CreateTemp(dir, filepath.Base(filename)+".tmp-*")
	if err != nil {
		return err
	}
	defer func() {
		_ = os.Remove(tmp.Name())
	}()
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), filename)
}

func main() {
	var jsonFile string
	var timeout time.Duration
	flag.StringVar(&jsonFile, "file", "backend/coins/btc/headers/checkpoints.json", "path to checkpoints JSON")
	flag.DurationVar(&timeout, "timeout", 30*time.Second, "timeout per network")
	flag.Parse()

	fatalf := func(format string, args ...any) {
		_, _ = fmt.Fprintf(os.Stderr, format+"\n", args...)
		os.Exit(1)
	}

	logrusLogger := logrus.New()
	logrusLogger.SetLevel(logrus.InfoLevel)
	log := logrusLogger.WithField("group", "update_btc_checkpoints")

	jsonRaw, err := os.ReadFile(jsonFile)
	if err != nil {
		fatalf("failed to read %s: %v", jsonFile, err)
	}
	var file btcHeaders.CheckpointsJSONFile
	if err := json.Unmarshal(jsonRaw, &file); err != nil {
		fatalf("failed to parse %s: %v", jsonFile, err)
	}

	update := func(code coinpkg.Code) (int, string) {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		height, hash, err := fetchTipCheckpoint(ctx, code, log.WithField("coin", code))
		if err != nil {
			fatalf("failed to fetch tip checkpoint for %s: %v", code, err)
		}
		return height, hash
	}

	height, hash := update(coinpkg.CodeBTC)
	file.BTC.Mainnet.Height = int32(height)
	file.BTC.Mainnet.Hash = hash

	height, hash = update(coinpkg.CodeTBTC)
	file.BTC.Testnet3.Height = int32(height)
	file.BTC.Testnet3.Hash = hash

	height, hash = update(coinpkg.CodeLTC)
	file.LTC.Mainnet.Height = int32(height)
	file.LTC.Mainnet.Hash = hash

	height, hash = update(coinpkg.CodeTLTC)
	file.LTC.Testnet4.Height = int32(height)
	file.LTC.Testnet4.Hash = hash

	updatedRaw, err := json.MarshalIndent(&file, "", "  ")
	if err != nil {
		fatalf("failed to encode JSON: %v", err)
	}
	updatedRaw = append(updatedRaw, '\n')
	if err := writeFileAtomic(jsonFile, updatedRaw); err != nil {
		fatalf("failed to write %s: %v", jsonFile, err)
	}

	fmt.Printf("updated checkpoints in %s\n", jsonFile)
}
