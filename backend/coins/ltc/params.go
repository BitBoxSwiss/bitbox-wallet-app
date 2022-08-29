// Copyright (c) 2014-2016 The btcsuite developers
// Use of this source code is governed by an ISC
// license that can be found in the LICENSE file.

package ltc

import (
	"math/big"
	"time"

	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
)

// These variables are the chain proof-of-work limit parameters for each default
// network.
var (
	// mainPowLimit is the highest proof of work value a Litecoin block can
	// have for the main network.
	mainPowLimit, _ = new(big.Int).SetString("0x0fffff000000000000000000000000000000000000000000000000000000", 0)

	// testNet4PowLimit is the highest proof of work value a Litecoin block
	// can have for the test network (version 4).
	testNet4PowLimit, _ = new(big.Int).SetString("0x0fffff000000000000000000000000000000000000000000000000000000", 0)
)

// MainNetParams defines the network parameters for the main Litecoin network.
var MainNetParams = chaincfg.Params{
	Name:        "mainnet",
	Net:         MainNet,
	DefaultPort: "9333",
	DNSSeeds: []chaincfg.DNSSeed{
		{Host: "seed-a.litecoin.loshan.co.uk", HasFiltering: true},
		{Host: "dnsseed.thrasher.io", HasFiltering: true},
		{Host: "dnsseed.litecointools.com", HasFiltering: false},
		{Host: "dnsseed.litecoinpool.org", HasFiltering: false},
		{Host: "dnsseed.koin-project.com", HasFiltering: false},
	},

	// Chain parameters
	GenesisBlock:             &genesisBlock,
	GenesisHash:              &genesisHash,
	PowLimit:                 mainPowLimit,
	PowLimitBits:             504365055,
	BIP0034Height:            710000,
	BIP0065Height:            918684,
	BIP0066Height:            811879,
	CoinbaseMaturity:         100,
	SubsidyReductionInterval: 840000,
	TargetTimespan:           (time.Hour * 24 * 3) + (time.Hour * 12), // 3.5 days
	TargetTimePerBlock:       (time.Minute * 2) + (time.Second * 30),  // 2.5 minutes
	RetargetAdjustmentFactor: 4,                                       // 25% less, 400% more
	ReduceMinDifficulty:      false,
	MinDiffReductionTime:     0,
	GenerateSupported:        false,

	// Checkpoints ordered from oldest to newest.
	Checkpoints: []chaincfg.Checkpoint{
		{Height: 1500, Hash: newHashFromStr("841a2965955dd288cfa707a755d05a54e45f8bd476835ec9af4402a2b59a2967")},
		{Height: 4032, Hash: newHashFromStr("9ce90e427198fc0ef05e5905ce3503725b80e26afd35a987965fd7e3d9cf0846")},
		{Height: 8064, Hash: newHashFromStr("eb984353fc5190f210651f150c40b8a4bab9eeeff0b729fcb3987da694430d70")},
		{Height: 16128, Hash: newHashFromStr("602edf1859b7f9a6af809f1d9b0e6cb66fdc1d4d9dcd7a4bec03e12a1ccd153d")},
		{Height: 23420, Hash: newHashFromStr("d80fdf9ca81afd0bd2b2a90ac3a9fe547da58f2530ec874e978fce0b5101b507")},
		{Height: 50000, Hash: newHashFromStr("69dc37eb029b68f075a5012dcc0419c127672adb4f3a32882b2b3e71d07a20a6")},
		{Height: 80000, Hash: newHashFromStr("4fcb7c02f676a300503f49c764a89955a8f920b46a8cbecb4867182ecdb2e90a")},
		{Height: 120000, Hash: newHashFromStr("bd9d26924f05f6daa7f0155f32828ec89e8e29cee9e7121b026a7a3552ac6131")},
		{Height: 161500, Hash: newHashFromStr("dbe89880474f4bb4f75c227c77ba1cdc024991123b28b8418dbbf7798471ff43")},
		{Height: 179620, Hash: newHashFromStr("2ad9c65c990ac00426d18e446e0fd7be2ffa69e9a7dcb28358a50b2b78b9f709")},
		{Height: 240000, Hash: newHashFromStr("7140d1c4b4c2157ca217ee7636f24c9c73db39c4590c4e6eab2e3ea1555088aa")},
		{Height: 383640, Hash: newHashFromStr("2b6809f094a9215bafc65eb3f110a35127a34be94b7d0590a096c3f126c6f364")},
		{Height: 409004, Hash: newHashFromStr("487518d663d9f1fa08611d9395ad74d982b667fbdc0e77e9cf39b4f1355908a3")},
		{Height: 456000, Hash: newHashFromStr("bf34f71cc6366cd487930d06be22f897e34ca6a40501ac7d401be32456372004")},
		{Height: 638902, Hash: newHashFromStr("15238656e8ec63d28de29a8c75fcf3a5819afc953dcd9cc45cecc53baec74f38")},
		{Height: 721000, Hash: newHashFromStr("198a7b4de1df9478e2463bd99d75b714eab235a2e63e741641dc8a759a9840e5")},
		{Height: 1350342, Hash: newHashFromStr("2f4dd5e541ef90464536f3402ae9ddd9564ddcc896d6ed2f7cc367734176c5c1")},
	},

	// Consensus rule change deployments.
	//
	// The miner confirmation window is defined as:
	//   target proof of work timespan / target proof of work spacing
	RuleChangeActivationThreshold: 6048, // 75% of MinerConfirmationWindow
	MinerConfirmationWindow:       8064, //
	Deployments: [chaincfg.DefinedDeployments]chaincfg.ConsensusDeployment{
		chaincfg.DeploymentTestDummy: {
			BitNumber: 28,
			DeploymentStarter: chaincfg.NewMedianTimeDeploymentStarter(
				time.Unix(11991456010, 0), // January 1, 2008 UTC
			),
			DeploymentEnder: chaincfg.NewMedianTimeDeploymentEnder(
				time.Unix(1230767999, 0), // December 31, 2008 UTC
			),
		},
		chaincfg.DeploymentTestDummyMinActivation: {
			BitNumber:                 22,
			CustomActivationThreshold: 1815,    // Only needs 90% hash rate.
			MinActivationHeight:       10_0000, // Can only activate after height 10k.
			DeploymentStarter: chaincfg.NewMedianTimeDeploymentStarter(
				time.Time{}, // Always available for vote
			),
			DeploymentEnder: chaincfg.NewMedianTimeDeploymentEnder(
				time.Time{}, // Never expires
			),
		},
		chaincfg.DeploymentCSV: {
			BitNumber: 0,
			DeploymentStarter: chaincfg.NewMedianTimeDeploymentStarter(
				time.Unix(1462060800, 0), // May 1st, 2016
			),
			DeploymentEnder: chaincfg.NewMedianTimeDeploymentEnder(
				time.Unix(1493596800, 0), // May 1st, 2017
			),
		},
		chaincfg.DeploymentSegwit: {
			BitNumber: 1,
			DeploymentStarter: chaincfg.NewMedianTimeDeploymentStarter(
				time.Unix(1479168000, 0), // November 15, 2016 UTC
			),
			DeploymentEnder: chaincfg.NewMedianTimeDeploymentEnder(
				time.Unix(1510704000, 0), // November 15, 2017 UTC.
			),
		},
	},

	// Mempool parameters
	RelayNonStdTxs: false,

	// Human-readable part for Bech32 encoded segwit addresses, as defined in
	// BIP 173.
	Bech32HRPSegwit: "ltc", // always ltc for main net

	// Address encoding magics
	PubKeyHashAddrID:        0x30, // starts with L
	ScriptHashAddrID:        0x32, // starts with M
	PrivateKeyID:            0xB0, // starts with 6 (uncompressed) or T (compressed)
	WitnessPubKeyHashAddrID: 0x06, // starts with p2
	WitnessScriptHashAddrID: 0x0A, // starts with 7Xh

	// BIP32 hierarchical deterministic extended key magics
	HDPrivateKeyID: [4]byte{0x04, 0x88, 0xad, 0xe4}, // starts with xprv
	HDPublicKeyID:  [4]byte{0x04, 0x88, 0xb2, 0x1e}, // starts with xpub

	// BIP44 coin type used in the hierarchical deterministic path for
	// address generation.
	HDCoinType: 2,
}

// TestNet4Params defines the network parameters for the test Litecoin network
// (version 4).  Not to be confused with the regression test network, this
// network is sometimes simply called "testnet".
var TestNet4Params = chaincfg.Params{
	Name:        "testnet4",
	Net:         TestNet4,
	DefaultPort: "19335",
	DNSSeeds: []chaincfg.DNSSeed{
		{Host: "testnet-seed.litecointools.com", HasFiltering: false},
		{Host: "seed-b.litecoin.loshan.co.uk", HasFiltering: true},
		{Host: "dnsseed-testnet.thrasher.io", HasFiltering: true},
	},

	// Chain parameters
	GenesisBlock:             &testNet4GenesisBlock,
	GenesisHash:              &testNet4GenesisHash,
	PowLimit:                 testNet4PowLimit,
	PowLimitBits:             504365055,
	BIP0034Height:            76,
	BIP0065Height:            76,
	BIP0066Height:            76,
	CoinbaseMaturity:         100,
	SubsidyReductionInterval: 840000,
	TargetTimespan:           (time.Hour * 24 * 3) + (time.Hour * 12), // 3.5 days
	TargetTimePerBlock:       (time.Minute * 2) + (time.Second * 30),  // 2.5 minutes
	RetargetAdjustmentFactor: 4,                                       // 25% less, 400% more
	ReduceMinDifficulty:      true,
	MinDiffReductionTime:     time.Minute * 5, // TargetTimePerBlock * 2
	GenerateSupported:        false,

	// Checkpoints ordered from oldest to newest.
	Checkpoints: []chaincfg.Checkpoint{
		{Height: 26115, Hash: newHashFromStr("817d5b509e91ab5e439652eee2f59271bbc7ba85021d720cdb6da6565b43c14f")},
		{Height: 43928, Hash: newHashFromStr("7d86614c153f5ef6ad878483118ae523e248cd0dd0345330cb148e812493cbb4")},
		{Height: 69296, Hash: newHashFromStr("66c2f58da3cfd282093b55eb09c1f5287d7a18801a8ff441830e67e8771010df")},
		{Height: 99949, Hash: newHashFromStr("8dd471cb5aecf5ead91e7e4b1e932c79a0763060f8d93671b6801d115bfc6cde")},
		{Height: 159256, Hash: newHashFromStr("ab5b0b9968842f5414804591119d6db829af606864b1959a25d6f5c114afb2b7")},
	},

	// Consensus rule change deployments.
	//
	// The miner confirmation window is defined as:
	//   target proof of work timespan / target proof of work spacing
	RuleChangeActivationThreshold: 1512, // 75% of MinerConfirmationWindow
	MinerConfirmationWindow:       2016,
	Deployments: [chaincfg.DefinedDeployments]chaincfg.ConsensusDeployment{
		chaincfg.DeploymentTestDummy: {
			BitNumber: 28,
			DeploymentStarter: chaincfg.NewMedianTimeDeploymentStarter(
				time.Time{}, // Always available for vote
			),
			DeploymentEnder: chaincfg.NewMedianTimeDeploymentEnder(
				time.Time{}, // Never expires
			),
		},
		chaincfg.DeploymentTestDummyMinActivation: {
			BitNumber:                 22,
			CustomActivationThreshold: 72,  // Only needs 50% hash rate.
			MinActivationHeight:       600, // Can only activate after height 600.
			DeploymentStarter: chaincfg.NewMedianTimeDeploymentStarter(
				time.Time{}, // Always available for vote
			),
			DeploymentEnder: chaincfg.NewMedianTimeDeploymentEnder(
				time.Time{}, // Never expires
			),
		},
		chaincfg.DeploymentCSV: {
			BitNumber: 0,
			DeploymentStarter: chaincfg.NewMedianTimeDeploymentStarter(
				time.Time{}, // Always available for vote
			),
			DeploymentEnder: chaincfg.NewMedianTimeDeploymentEnder(
				time.Time{}, // Never expires
			),
		},
		chaincfg.DeploymentSegwit: {
			BitNumber: 1,
			DeploymentStarter: chaincfg.NewMedianTimeDeploymentStarter(
				time.Time{}, // Always available for vote
			),
			DeploymentEnder: chaincfg.NewMedianTimeDeploymentEnder(
				time.Time{}, // Never expires.
			),
		},
	},

	// Mempool parameters
	RelayNonStdTxs: true,

	// Human-readable part for Bech32 encoded segwit addresses, as defined in
	// BIP 173.
	Bech32HRPSegwit: "tltc", // always tb for test net

	// Address encoding magics
	PubKeyHashAddrID:        0x6f, // starts with m or n
	ScriptHashAddrID:        0xc4, // starts with 2
	WitnessPubKeyHashAddrID: 0x52, // starts with QW
	WitnessScriptHashAddrID: 0x31, // starts with T7n
	PrivateKeyID:            0xef, // starts with 9 (uncompressed) or c (compressed)

	// BIP32 hierarchical deterministic extended key magics
	HDPrivateKeyID: [4]byte{0x04, 0x35, 0x83, 0x94}, // starts with tprv
	HDPublicKeyID:  [4]byte{0x04, 0x35, 0x87, 0xcf}, // starts with tpub

	// BIP44 coin type used in the hierarchical deterministic path for
	// address generation.
	HDCoinType: 1,
}

// newHashFromStr converts the passed big-endian hex string into a
// chainhash.Hash.  It only differs from the one available in chainhash in that
// it panics on an error since it will only (and must only) be called with
// hard-coded, and therefore known good, hashes.
func newHashFromStr(hexStr string) *chainhash.Hash {
	hash, err := chainhash.NewHashFromStr(hexStr)
	if err != nil {
		// Ordinarily I don't like panics in library code since it
		// can take applications down without them having a chance to
		// recover which is extremely annoying, however an exception is
		// being made in this case because the only way this can panic
		// is if there is an error in the hard-coded hashes.  Thus it
		// will only ever potentially panic on init and therefore is
		// 100% predictable.
		panic(err)
	}
	return hash
}

// mustRegister performs the same function as Register except it panics if there
// is an error.  This should only be called from package init functions.
func mustRegister(params *chaincfg.Params) {
	if err := chaincfg.Register(params); err != nil {
		panic("failed to register network: " + err.Error())
	}
}

func init() {
	// Register all default networks when the package is initialized.
	mustRegister(&MainNetParams)
	mustRegister(&TestNet4Params)
}
