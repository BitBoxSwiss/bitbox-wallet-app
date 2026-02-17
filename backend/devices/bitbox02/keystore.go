// SPDX-License-Identifier: Apache-2.0

package bitbox02

import (
	"sync"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/btc/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/ltc"
	keystorePkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/keystore"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/signing"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware"
	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/btcutil/psbt"
	"github.com/btcsuite/btcd/chaincfg"
	ethTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/params"
	"github.com/sirupsen/logrus"
)

type keystore struct {
	device *Device
	log    *logrus.Entry

	rootFingerMu sync.Mutex
	rootFinger   []byte // cached result of RootFingerprint
}

// Type implements keystore.Keystore.
func (keystore *keystore) Type() keystorePkg.Type {
	return keystorePkg.TypeHardware
}

// Name implements keystore.Keystore.
func (keystore *keystore) Name() (string, error) {
	info, err := keystore.device.DeviceInfo()
	if err != nil {
		return "", errp.WithStack(err)
	}
	return info.Name, nil
}

// RootFingerprint implements keystore.Keystore.
func (keystore *keystore) RootFingerprint() ([]byte, error) {
	keystore.rootFingerMu.Lock()
	defer keystore.rootFingerMu.Unlock()
	if keystore.rootFinger != nil {
		return keystore.rootFinger, nil
	}
	res, err := keystore.device.RootFingerprint()
	if err != nil {
		return nil, err
	}
	keystore.rootFinger = res
	return res, nil
}

// SupportsCoin implements keystore.Keystore.
func (keystore *keystore) SupportsCoin(coin coinpkg.Coin) bool {
	switch specificCoin := coin.(type) {
	case *btc.Coin:
		if (coin.Code() == coinpkg.CodeLTC || coin.Code() == coinpkg.CodeTLTC) && !keystore.device.SupportsLTC() {
			return false
		}
		return true
	case *eth.Coin:
		if specificCoin.ERC20Token() != nil {
			return keystore.device.SupportsERC20(specificCoin.ERC20Token().ContractAddress().String())
		}
		return keystore.device.SupportsETH(specificCoin.ChainID())
	default:
		return false
	}
}

// SupportsAccount implements keystore.Keystore.
func (keystore *keystore) SupportsAccount(coin coinpkg.Coin, meta interface{}) bool {
	if !keystore.SupportsCoin(coin) {
		return false
	}
	switch coin.(type) {
	case *btc.Coin:
		scriptType := meta.(signing.ScriptType)
		if scriptType == signing.ScriptTypeP2TR {
			// Taproot available since v9.10.0.
			switch coin.Code() {
			case coinpkg.CodeBTC, coinpkg.CodeTBTC, coinpkg.CodeRBTC:
				return keystore.device.Version().AtLeast(semver.NewSemVer(9, 10, 0))
			default:
				return false
			}
		}
		return scriptType != signing.ScriptTypeP2PKH
	default:
		return true
	}
}

// SupportsMultipleAccounts implements keystore.Keystore.
func (keystore *keystore) SupportsMultipleAccounts() bool {
	return true
}

// CanVerifyAddress implements keystore.Keystore.
func (keystore *keystore) CanVerifyAddress(coin coinpkg.Coin) (bool, bool, error) {
	const optional = false
	switch coin.(type) {
	case *btc.Coin:
		_, ok := btcMsgCoinMap[coin.Code()]
		return ok, optional, nil
	case *eth.Coin:
		return true, optional, nil
	}
	return false, false, nil
}

// VerifyAddressBTC implements keystore.Keystore.
func (keystore *keystore) VerifyAddressBTC(
	accountConfiguration *signing.Configuration,
	derivation types.Derivation, coin coinpkg.Coin) error {
	canVerifyAddress, _, err := keystore.CanVerifyAddress(coin)
	if err != nil {
		return err
	}
	if !canVerifyAddress {
		panic("CanVerifyAddress must be true")
	}
	msgScriptType, ok := btcMsgScriptTypeMap[accountConfiguration.ScriptType()]
	if !ok {
		panic("unsupported scripttype")
	}
	keypath := accountConfiguration.AbsoluteKeypath().
		Child(derivation.SimpleChainIndex(), false).
		Child(derivation.AddressIndex, false)
	_, err = keystore.device.BTCAddress(
		btcMsgCoinMap[coin.Code()],
		keypath.ToUInt32(),
		firmware.NewBTCScriptConfigSimple(msgScriptType),
		true,
	)
	if firmware.IsErrorAbort(err) {
		// No special action on user abort.
		return nil
	}
	return err
}

// VerifyAddressETH implements keystore.Keystore.
func (keystore *keystore) VerifyAddressETH(
	configuration *signing.Configuration, coin coinpkg.Coin) error {
	canVerifyAddress, _, err := keystore.CanVerifyAddress(coin)
	if err != nil {
		return err
	}
	if !canVerifyAddress {
		panic("CanVerifyAddress must be true")
	}
	specificCoin := coin.(*eth.Coin)
	// No contract address, displays 'Ethereum' etc. depending on `msgCoin`.
	contractAddress := []byte{}
	if specificCoin.ERC20Token() != nil {
		// Displays the erc20 unit based on the contract.
		contractAddress = specificCoin.ERC20Token().ContractAddress().Bytes()
	}
	_, err = keystore.device.ETHPub(
		specificCoin.ChainID(), configuration.AbsoluteKeypath().ToUInt32(),
		messages.ETHPubRequest_ADDRESS, true, contractAddress)
	if firmware.IsErrorAbort(err) {
		// No special action on user abort.
		return nil
	}
	return err
}

// CanVerifyExtendedPublicKey implements keystore.Keystore.
func (keystore *keystore) CanVerifyExtendedPublicKey() bool {
	return true
}

func (keystore *keystore) VerifyExtendedPublicKey(
	coin coinpkg.Coin, configuration *signing.Configuration) error {
	if !keystore.CanVerifyExtendedPublicKey() {
		panic("CanVerifyExtendedPublicKey must be true")
	}
	switch specificCoin := coin.(type) {
	case *btc.Coin:
		msgCoin, ok := btcMsgCoinMap[coin.Code()]
		if !ok {
			return errp.New("unsupported coin")
		}
		var msgXPubType messages.BTCPubRequest_XPubType
		switch specificCoin.Net().Net {
		case chaincfg.MainNetParams.Net, ltc.MainNetParams.Net:
			msgXPubTypes := map[signing.ScriptType]messages.BTCPubRequest_XPubType{
				signing.ScriptTypeP2WPKHP2SH: messages.BTCPubRequest_YPUB,
				signing.ScriptTypeP2WPKH:     messages.BTCPubRequest_ZPUB,
			}
			msgXPubType, ok = msgXPubTypes[configuration.ScriptType()]
			if !ok {
				msgXPubType = messages.BTCPubRequest_XPUB
			}
		case chaincfg.TestNet3Params.Net, ltc.TestNet4Params.Net:
			msgXPubType = messages.BTCPubRequest_TPUB
		default:
			msgXPubType = messages.BTCPubRequest_XPUB
		}
		_, err := keystore.device.BTCXPub(
			msgCoin, configuration.AbsoluteKeypath().ToUInt32(), msgXPubType, true)
		if firmware.IsErrorAbort(err) {
			// No special action taken on user abort.
			return nil
		}
		if err != nil {
			return err
		}
	case *eth.Coin:
		return errp.New("unsupported operation")
	}
	return nil
}

// ExtendedPublicKey implements keystore.Keystore.
func (keystore *keystore) ExtendedPublicKey(
	coin coinpkg.Coin, keyPath signing.AbsoluteKeypath) (*hdkeychain.ExtendedKey, error) {
	switch specificCoin := coin.(type) {
	case *btc.Coin:
		msgCoin, ok := btcMsgCoinMap[coin.Code()]
		if !ok {
			return nil, errp.New("unsupported coin")
		}
		xpubStr, err := keystore.device.BTCXPub(
			msgCoin, keyPath.ToUInt32(),
			messages.BTCPubRequest_XPUB, false)
		if err != nil {
			return nil, err
		}
		return hdkeychain.NewKeyFromString(xpubStr)
	case *eth.Coin:
		// The BitBox02 only accepts four-element keypaths to get the xpub, e.g.
		// m/44'/60'/0'/0.
		//
		// In Ethereum, the element defining the account is the fifth element, e.g. the 10th account
		// is at m/44'/60'/0'/0/9.
		//
		// To get the xpub at the account-level keypath, we workaround this by getting the base xpub
		// and deriving the last step here.
		keypathUint32 := keyPath.ToUInt32()
		if len(keypathUint32) == 5 {
			xpubStr, err := keystore.device.ETHPub(
				specificCoin.ChainID(), keypathUint32[:4], messages.ETHPubRequest_XPUB, false, []byte{})
			if err != nil {
				return nil, err
			}
			xpub, err := hdkeychain.NewKeyFromString(xpubStr)
			if err != nil {
				return nil, err
			}
			return xpub.Derive(keypathUint32[4])
		}
		xpubStr, err := keystore.device.ETHPub(
			specificCoin.ChainID(), keypathUint32, messages.ETHPubRequest_XPUB, false, []byte{})
		if err != nil {
			return nil, err
		}
		return hdkeychain.NewKeyFromString(xpubStr)
	default:
		return nil, errp.New("unsupported coin")
	}
}

// BTCXPubs implements keystore.Keystore.
func (keystore *keystore) BTCXPubs(
	coin coinpkg.Coin, keypaths []signing.AbsoluteKeypath) ([]*hdkeychain.ExtendedKey, error) {
	msgCoin, ok := btcMsgCoinMap[coin.Code()]
	if !ok {
		return nil, errp.New("unsupported coin")
	}

	keypathsU32 := make([][]uint32, len(keypaths))
	for i, keypath := range keypaths {
		keypathsU32[i] = keypath.ToUInt32()
	}
	xpubStrs, err := keystore.device.BTCXPubs(
		msgCoin, keypathsU32, messages.BTCXpubsRequest_XPUB)
	if err != nil {
		return nil, err
	}
	xpubs := make([]*hdkeychain.ExtendedKey, len(keypaths))
	for i, xpubStr := range xpubStrs {
		xpub, err := hdkeychain.NewKeyFromString(xpubStr)
		if err != nil {
			return nil, err
		}
		xpubs[i] = xpub
	}
	return xpubs, nil
}

func (keystore *keystore) signBTCTransaction(btcProposedTx *btc.ProposedTransaction) error {
	// Handle displaying formatting in btc or sats.
	formatUnit := messages.BTCSignInitRequest_DEFAULT
	if btcProposedTx.FormatUnit == coinpkg.BtcUnitSats {
		formatUnit = messages.BTCSignInitRequest_SAT
	}

	coin := btcProposedTx.TXProposal.Coin.(*btc.Coin)
	msgCoin, ok := btcMsgCoinMap[coin.Code()]
	if !ok {
		return errp.Newf("coin not supported: %s", coin.Code())
	}

	// Payment request handling
	newBTCPaymentRequest := func(txPaymentRequest *accounts.PaymentRequest) *messages.BTCPaymentRequestRequest {
		memos := []*messages.BTCPaymentRequestRequest_Memo{}
		for _, m := range txPaymentRequest.Memos {
			memo := messages.BTCPaymentRequestRequest_Memo{
				Memo: &messages.BTCPaymentRequestRequest_Memo_TextMemo_{
					TextMemo: &messages.BTCPaymentRequestRequest_Memo_TextMemo{
						Note: m.Note,
					},
				},
			}
			memos = append(memos, &memo)
		}

		return &messages.BTCPaymentRequestRequest{
			RecipientName: txPaymentRequest.RecipientName,
			Nonce:         txPaymentRequest.Nonce,
			TotalAmount:   txPaymentRequest.TotalAmount,
			Signature:     txPaymentRequest.Signature,
			Memos:         memos,
		}
	}

	var btcPaymentRequests []*messages.BTCPaymentRequestRequest
	paymentRequest := btcProposedTx.TXProposal.PaymentRequest
	var paymentRequestIndex *uint32
	if paymentRequest != nil {
		btcPaymentRequests = []*messages.BTCPaymentRequestRequest{
			newBTCPaymentRequest(paymentRequest),
		}
		prIndex := uint32(0)
		paymentRequestIndex = &prIndex
	}

	signOptions := &firmware.PSBTSignOptions{
		FormatUnit:      formatUnit,
		PaymentRequests: btcPaymentRequests,
		Outputs: map[int]*firmware.PSBTSignOutputOptions{
			btcProposedTx.TXProposal.OutIndex: {
				SilentPaymentAddress: btcProposedTx.TXProposal.SilentPaymentAddress,
				PaymentRequestIndex:  paymentRequestIndex,
			},
		},
	}

	// Include previous transactions in PSBT if the BitBox requires it.
	needsPrevTxs, err := keystore.device.BTCSignNeedsNonWitnessUTXOs(
		btcProposedTx.TXProposal.Psbt, signOptions)
	if err != nil {
		return err
	}
	if needsPrevTxs {
		updater, err := psbt.NewUpdater(btcProposedTx.TXProposal.Psbt)
		if err != nil {
			return err
		}

		for index, txIn := range btcProposedTx.TXProposal.Psbt.UnsignedTx.TxIn {
			prevTx, err := btcProposedTx.GetPrevTx(txIn.PreviousOutPoint.Hash)
			if err != nil {
				return err
			}
			if err := updater.AddInNonWitnessUtxo(prevTx, index); err != nil {
				return err
			}
		}
	}

	err = keystore.device.BTCSignPSBT(
		msgCoin,
		btcProposedTx.TXProposal.Psbt,
		signOptions)
	if firmware.IsErrorAbort(err) {
		return errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	return err
}

func (keystore *keystore) signETHTransaction(txProposal *eth.TxProposal) error {
	var signature []byte
	var err error
	tx := txProposal.Tx
	recipient := tx.To()
	if recipient == nil {
		return errp.New("contract creation not supported")
	}
	txType := tx.Type()
	switch txType { // version bytes defined in EIP2718 https://eips.ethereum.org/EIPS/eip-2718
	case 2:
		signature, err = keystore.device.ETHSignEIP1559(
			txProposal.Coin.ChainID(),
			txProposal.Keypath.ToUInt32(),
			tx.Nonce(),
			tx.GasTipCap(),
			tx.GasFeeCap(),
			tx.Gas(),
			*recipient,
			tx.Value(),
			tx.Data(),
			firmware.ETHIdentifyCase(txProposal.RecipientAddress),
		)
	case 0:
		signature, err = keystore.device.ETHSign(
			txProposal.Coin.ChainID(),
			txProposal.Keypath.ToUInt32(),
			tx.Nonce(),
			tx.GasPrice(),
			tx.Gas(),
			*recipient,
			tx.Value(),
			tx.Data(),
			firmware.ETHIdentifyCase(txProposal.RecipientAddress),
		)
	default:
		return errp.New("unsupported transaction type")
	}
	if firmware.IsErrorAbort(err) {
		return errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	if err != nil {
		return err
	}
	signedTx, err := txProposal.Tx.WithSignature(txProposal.Signer, signature)
	if err != nil {
		return err
	}
	txProposal.Tx = signedTx
	return nil
}

// SignTransaction implements keystore.Keystore.
func (keystore *keystore) SignTransaction(proposedTx interface{}) error {
	switch specificProposedTx := proposedTx.(type) {
	case *btc.ProposedTransaction:
		return keystore.signBTCTransaction(specificProposedTx)
	case *eth.TxProposal:
		return keystore.signETHTransaction(specificProposedTx)
	default:
		panic("unknown proposal type")
	}
}

// CanSignMessage implements keystore.Keystore.
func (keystore *keystore) CanSignMessage(code coinpkg.Code) bool {
	return code == coinpkg.CodeBTC ||
		code == coinpkg.CodeTBTC ||
		code == coinpkg.CodeETH ||
		code == coinpkg.CodeRBTC
}

// SignBTCMessage implements keystore.Keystore.
func (keystore *keystore) SignBTCMessage(message []byte, keypath signing.AbsoluteKeypath, scriptType signing.ScriptType, coin coinpkg.Code) ([]byte, error) {
	sc, ok := btcMsgScriptTypeMap[scriptType]
	if !ok {
		return nil, errp.Newf("scriptType not supported: %s", scriptType)
	}
	messageCoin, ok := btcMsgCoinMap[coin]
	if !ok {
		return nil, errp.Newf("coin not supported: %s", coin)
	}
	signResult, err := keystore.device.BTCSignMessage(
		messageCoin,
		&messages.BTCScriptConfigWithKeypath{
			ScriptConfig: firmware.NewBTCScriptConfigSimple(sc),
			Keypath:      keypath.ToUInt32(),
		},
		message,
	)
	if firmware.IsErrorAbort(err) {
		return nil, errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	if err != nil {
		return nil, err
	}
	return signResult.ElectrumSig65, err
}

// SignETHMessage implements keystore.Keystore.
func (keystore *keystore) SignETHMessage(message []byte, keypath signing.AbsoluteKeypath) ([]byte, error) {
	signature, err := keystore.device.ETHSignMessage(params.MainnetChainConfig.ChainID.Uint64(), keypath.ToUInt32(), message)
	if firmware.IsErrorAbort(err) {
		return nil, errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	if err != nil {
		return nil, err
	}
	return signature, nil
}

// SignETHTypedMessage implements keystore.Keystore.
func (keystore *keystore) SignETHTypedMessage(chainId uint64, data []byte, keypath signing.AbsoluteKeypath) ([]byte, error) {
	signature, err := keystore.device.ETHSignTypedMessage(chainId, keypath.ToUInt32(), data)
	if firmware.IsErrorAbort(err) {
		return nil, errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	if err != nil {
		return nil, err
	}
	return signature, nil
}

// SignETHWalletConnectTransaction implements keystore.Keystore.
func (keystore *keystore) SignETHWalletConnectTransaction(chainId uint64, tx *ethTypes.Transaction, keypath signing.AbsoluteKeypath) ([]byte, error) {
	signature, err := keystore.device.ETHSign(
		chainId,
		keypath.ToUInt32(),
		tx.Nonce(),
		tx.GasPrice(),
		tx.Gas(),
		*tx.To(),
		tx.Value(),
		tx.Data(),
		messages.ETHAddressCase_ETH_ADDRESS_CASE_MIXED,
	)
	if firmware.IsErrorAbort(err) {
		return nil, errp.WithStack(keystorePkg.ErrSigningAborted)
	}
	if err != nil {
		return nil, err
	}
	return signature, nil
}

// SupportsEIP1559 implements keystore.Keystore.
func (keystore *keystore) SupportsEIP1559() bool {
	return keystore.device.Version().AtLeast(semver.NewSemVer(9, 16, 0))
}

// SupportsPaymentRequests implements keystore.Keystore.
func (keystore *keystore) SupportsPaymentRequests() error {
	if keystore.device.Version().AtLeast(semver.NewSemVer(9, 20, 0)) {
		return nil
	}
	return keystorePkg.ErrFirmwareUpgradeRequired
}

// Features reports optional capabilities supported by the BitBox02 keystore.
func (keystore *keystore) Features() *keystorePkg.Features {
	return &keystorePkg.Features{
		SupportsSendToSelf: keystore.device.Version().AtLeast(semver.NewSemVer(9, 22, 0)),
	}
}
