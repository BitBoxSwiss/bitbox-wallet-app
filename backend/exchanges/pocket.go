package exchanges

import (
	"encoding/base64"
	"fmt"

	"github.com/digitalbitbox/bitbox-wallet-app/backend/accounts"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/coins/coin"
	"github.com/digitalbitbox/bitbox-wallet-app/backend/signing"
)

const (
	// pocketAPITestURL is the url of the pocket widget in test environment.
	pocketAPITestURL = "https://widget.staging.pocketbitcoin.com/widget_mjxWDmSUkMvdQdXDCeHrjC"

	// pocketAPILiveURL is the url of the pocket widget in production environment.
	pocketAPILiveURL = "https://widget.pocketbitcoin.com/widget_vqx25E6kzvGBYGjN2QoXVH"
)

// PocketURL returns the url needed to incorporate the widget in the frontend, verifying
// if the account is mainnet or testnet.
func PocketURL(acct accounts.Interface) (string, error) {
	apiURL := ""
	switch acct.Coin().Code() {
	case coin.CodeBTC:
		apiURL = pocketAPILiveURL
	case coin.CodeTBTC:
		apiURL = pocketAPITestURL
	default:
		err := fmt.Errorf("unsupported cryptocurrency code %q", acct.Coin().Code())
		return "", err

	}
	return apiURL, nil
}

// IsPocketSupported is true if coin.Code is supported by Pocket.
func IsPocketSupported(account accounts.Interface) bool {
	coinCode := account.Coin().Code()
	canSign := account.Config().Keystore.CanSignMessage(coinCode)
	// Pocket would also support tbtc, but at the moment testnet address signing is disabled on firmware.
	return (coinCode == coin.CodeBTC || coinCode == coin.CodeTBTC) && canSign
}

// PocketWidgetSignAddress returns an unused address and makes the user sign a message to prove ownership.
// Input params:
// 	`account` is the account from which the address is derived, and that will be linked to the Pocket order.
// 	`message` is the message that will be signed by the user with the private key linked to the address.
//	`format` is the script type that should be used in the address derivation, as received by the widget
//		(see https://github.com/pocketbitcoin/request-address#requestaddressv0messagescripttype).
// 	`aoppBTCScriptTypeMap` is the map used in the AOPP flow to get the `ScriptType` object related to the `format` param.
//
// Returned values:
//	#1: is the first unused address corresponding to the account and the script type identified by the input values.
//	#2: base64 encoding of the message signature, obtained using the private key linked to the address.
//	#3: is an optional error that could be generated during the execution of the function.
func PocketWidgetSignAddress(account accounts.Interface, message string, format string, aoppBTCScriptTypeMap map[string]signing.ScriptType) (string, string, error) {

	if !IsPocketSupported(account) {
		err := fmt.Errorf("Coin not supported %s", account.Coin().Code())
		return "", "", err
	}

	unused := account.GetUnusedReceiveAddresses()
	// Use the format hint to get a compatible address
	expectedScriptType, ok := aoppBTCScriptTypeMap[format]
	if !ok {
		err := fmt.Errorf("Unknown format:  %s", format)
		return "", "", err
	}
	signingConfigIdx := account.Config().SigningConfigurations.FindScriptType(expectedScriptType)
	if signingConfigIdx == -1 {
		err := fmt.Errorf("Unknown format: %s", format)
		return "", "", err
	}
	addr := unused[signingConfigIdx].Addresses[0]

	sig, err := account.Config().Keystore.SignBTCMessage(
		[]byte(message),
		addr.AbsoluteKeypath(),
		account.Config().SigningConfigurations[signingConfigIdx].ScriptType(),
	)
	if err != nil {
		return "", "", err
	}

	return addr.EncodeForHumans(), base64.StdEncoding.EncodeToString(sig), nil
}
