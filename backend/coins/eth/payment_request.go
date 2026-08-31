// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"math/big"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/ethereum/go-ethereum/common"
)

var (
	errInvalidPaymentRequest = errp.New("invalid Ethereum payment request")
	// ERC-681 (EIP-681) URL grammar: https://eips.ethereum.org/EIPS/eip-681
	paymentRequestTargetRE = regexp.MustCompile(`^(?:pay-)?(0x[0-9a-fA-F]{40})(?:@(\d+))?$`)
	paymentRequestAmountRE = regexp.MustCompile(`^(\d+)(?:\.(\d+))?(?:[eE](\d+))?$`)
)

// ErrPaymentRequestAccountMismatch means that the request targets a different chain or asset than
// the selected account.
const ErrPaymentRequestAccountMismatch errp.ErrorCode = "accountMismatch"

// PaymentRequest contains the recipient and optional amount from an ERC-681 payment request.
type PaymentRequest struct {
	Recipient string
	Amount    string
}

// ParsePaymentRequest parses an ERC-681 payment request for this coin.
func (coin *Coin) ParsePaymentRequest(input string) (*PaymentRequest, error) {
	parsed, err := url.Parse(strings.TrimSpace(input))
	if err != nil || !strings.EqualFold(parsed.Scheme, "ethereum") || parsed.Fragment != "" || parsed.Opaque == "" {
		return nil, errInvalidPaymentRequest
	}

	pathParts := strings.Split(parsed.Opaque, "/")
	if len(pathParts) > 2 {
		return nil, errInvalidPaymentRequest
	}
	targetMatch := paymentRequestTargetRE.FindStringSubmatch(pathParts[0])
	if targetMatch == nil || !IsValidEthAddress(targetMatch[1]) {
		return nil, errInvalidPaymentRequest
	}
	if targetMatch[2] != "" && normalizeNumber(targetMatch[2]) != coin.ChainIDstr() {
		return nil, ErrPaymentRequestAccountMismatch
	}

	parameters, err := url.ParseQuery(parsed.RawQuery)
	if err != nil {
		return nil, errInvalidPaymentRequest
	}
	if len(pathParts) == 2 {
		if pathParts[1] != "transfer" {
			return nil, errInvalidPaymentRequest
		}
		return coin.parseERC20Transfer(targetMatch[1], parameters)
	}
	for key := range parameters {
		if key != "value" {
			return nil, errInvalidPaymentRequest
		}
	}
	values := parameters["value"]
	if len(values) > 1 {
		return nil, errInvalidPaymentRequest
	}
	request := &PaymentRequest{Recipient: targetMatch[1]}
	if len(values) == 0 {
		return request, nil
	}
	atomicAmount, ok := parsePaymentRequestAtomicAmount(values[0])
	if !ok {
		return nil, errInvalidPaymentRequest
	}
	if coin.erc20Token != nil {
		return nil, ErrPaymentRequestAccountMismatch
	}
	request.Amount = formatPaymentRequestAmount(atomicAmount, coin.Decimals(false))
	return request, nil
}

func (coin *Coin) parseERC20Transfer(target string, parameters url.Values) (*PaymentRequest, error) {
	for key := range parameters {
		if key != "address" && key != "uint256" {
			return nil, errInvalidPaymentRequest
		}
	}
	recipients := parameters["address"]
	amounts := parameters["uint256"]
	if len(recipients) != 1 || len(amounts) > 1 {
		return nil, errInvalidPaymentRequest
	}
	if !IsValidEthAddress(recipients[0]) {
		return nil, errInvalidPaymentRequest
	}
	if coin.erc20Token == nil || common.HexToAddress(target) != coin.erc20Token.ContractAddress() {
		return nil, ErrPaymentRequestAccountMismatch
	}

	request := &PaymentRequest{Recipient: recipients[0]}
	if len(amounts) == 0 {
		return request, nil
	}
	atomicAmount, ok := parsePaymentRequestAtomicAmount(amounts[0])
	if !ok {
		return nil, errInvalidPaymentRequest
	}
	request.Amount = formatPaymentRequestAmount(atomicAmount, coin.Decimals(false))
	return request, nil
}

func normalizeNumber(number string) string {
	normalized := strings.TrimLeft(number, "0")
	if normalized == "" {
		return "0"
	}
	return normalized
}

func parsePaymentRequestAtomicAmount(value string) (*big.Int, bool) {
	match := paymentRequestAmountRE.FindStringSubmatch(value)
	if match == nil {
		return nil, false
	}
	fraction := match[2]
	exponent := uint64(0)
	if match[3] != "" {
		var err error
		exponent, err = strconv.ParseUint(match[3], 10, 64)
		if err != nil {
			return nil, false
		}
	}
	if exponent < uint64(len(fraction)) {
		return nil, false
	}

	significantDigits := strings.TrimLeft(match[1]+fraction, "0")
	if significantDigits == "" {
		return new(big.Int), true
	}
	trailingZeros := exponent - uint64(len(fraction))
	if trailingZeros > 78 || len(significantDigits) > 78-int(trailingZeros) {
		return nil, false
	}
	atomicAmount, ok := new(big.Int).SetString(
		significantDigits+strings.Repeat("0", int(trailingZeros)),
		10,
	)
	if !ok || atomicAmount.BitLen() > 256 {
		return nil, false
	}
	return atomicAmount, true
}

func formatPaymentRequestAmount(atomicAmount *big.Int, decimals uint) string {
	amount := atomicAmount.String()
	if decimals == 0 {
		return amount
	}
	if uint(len(amount)) <= decimals {
		amount = strings.Repeat("0", int(decimals)-len(amount)+1) + amount
	}
	split := len(amount) - int(decimals)
	fraction := strings.TrimRight(amount[split:], "0")
	if fraction == "" {
		return amount[:split]
	}
	return amount[:split] + "." + fraction
}
