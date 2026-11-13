// SPDX-License-Identifier: Apache-2.0

package eth

import (
	"math/big"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/errors"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/ethereum/go-ethereum/common"
)

var (
	// Supported hexadecimal-address subset of the ERC-681 (EIP-681) URL grammar:
	// https://eips.ethereum.org/EIPS/eip-681
	paymentRequestTargetRE = regexp.MustCompile(`^(?:pay-)?(0x[0-9a-fA-F]{40})(?:@(\d+))?$`)
	paymentRequestAmountRE = regexp.MustCompile(`^(\d+)(?:\.(\d+))?(?:[eE](\d+))?$`)
)

// ParsePaymentInput parses a bare address or supported native/ERC20 ERC-681 payment request.
// Address checks use IsValidEthAddress, which is also used by Account.newTx. Payment URIs
// additionally carry chain, token, and amount information that must match the selected coin.
func (coin *Coin) ParsePaymentInput(input string) (*coinpkg.ParsedPaymentInput, error) {
	input = strings.TrimSpace(input)
	parsed, err := url.Parse(input)
	if err != nil {
		return nil, coinpkg.ErrInvalidPaymentInput
	}
	if parsed.Scheme == "" {
		// Bare addresses carry no chain or token selection; the selected account supplies that context.
		parsedInput := &coinpkg.ParsedPaymentInput{Recipient: input}
		if !IsValidEthAddress(input) {
			parsedInput.ValidationError = errors.ErrInvalidAddress
		}
		return parsedInput, nil
	}
	if !strings.EqualFold(parsed.Scheme, "ethereum") || parsed.Fragment != "" || parsed.Opaque == "" {
		return nil, coinpkg.ErrInvalidPaymentInput
	}

	pathParts := strings.Split(parsed.Opaque, "/")
	if len(pathParts) > 2 {
		return nil, coinpkg.ErrInvalidPaymentInput
	}
	targetMatch := paymentRequestTargetRE.FindStringSubmatch(pathParts[0])
	if targetMatch == nil || !IsValidEthAddress(targetMatch[1]) {
		return nil, coinpkg.ErrInvalidPaymentInput
	}
	if targetMatch[2] != "" && normalizeNumber(targetMatch[2]) != coin.ChainIDstr() {
		return nil, coinpkg.ErrPaymentInputAccountMismatch
	}

	parameters, err := url.ParseQuery(parsed.RawQuery)
	if err != nil {
		return nil, coinpkg.ErrInvalidPaymentInput
	}
	if len(pathParts) == 2 {
		if pathParts[1] != "transfer" {
			return nil, coinpkg.ErrInvalidPaymentInput
		}
		return coin.parseERC20Transfer(targetMatch[1], parameters)
	}
	for key := range parameters {
		if key != "value" {
			return nil, coinpkg.ErrInvalidPaymentInput
		}
	}
	values := parameters["value"]
	if len(values) > 1 {
		return nil, coinpkg.ErrInvalidPaymentInput
	}
	parsedInput := &coinpkg.ParsedPaymentInput{Recipient: targetMatch[1]}
	if len(values) == 0 {
		return parsedInput, nil
	}
	atomicAmount, ok := parsePaymentRequestAtomicAmount(values[0])
	if !ok {
		return nil, coinpkg.ErrInvalidPaymentInput
	}
	if coin.erc20Token != nil {
		return nil, coinpkg.ErrPaymentInputAccountMismatch
	}
	formattedAmount := coin.FormatAmount(atomicAmount, false)
	parsedInput.Amount = &formattedAmount
	return parsedInput, nil
}

func (coin *Coin) parseERC20Transfer(target string, parameters url.Values) (*coinpkg.ParsedPaymentInput, error) {
	for key := range parameters {
		if key != "address" && key != "uint256" {
			return nil, coinpkg.ErrInvalidPaymentInput
		}
	}
	recipients := parameters["address"]
	amounts := parameters["uint256"]
	if len(recipients) != 1 || len(amounts) > 1 {
		return nil, coinpkg.ErrInvalidPaymentInput
	}
	if !IsValidEthAddress(recipients[0]) {
		return nil, coinpkg.ErrInvalidPaymentInput
	}
	if coin.erc20Token == nil || common.HexToAddress(target) != coin.erc20Token.ContractAddress() {
		return nil, coinpkg.ErrPaymentInputAccountMismatch
	}

	parsedInput := &coinpkg.ParsedPaymentInput{Recipient: recipients[0]}
	if len(amounts) == 0 {
		return parsedInput, nil
	}
	atomicAmount, ok := parsePaymentRequestAtomicAmount(amounts[0])
	if !ok {
		return nil, coinpkg.ErrInvalidPaymentInput
	}
	formattedAmount := coin.FormatAmount(atomicAmount, false)
	parsedInput.Amount = &formattedAmount
	return parsedInput, nil
}

func normalizeNumber(number string) string {
	normalized := strings.TrimLeft(number, "0")
	if normalized == "" {
		return "0"
	}
	return normalized
}

func parsePaymentRequestAtomicAmount(value string) (coinpkg.Amount, bool) {
	// The generic amount parser accepts more than ERC-681's decimal syntax, so constrain it first.
	match := paymentRequestAmountRE.FindStringSubmatch(value)
	if match == nil {
		return coinpkg.Amount{}, false
	}
	fraction := match[2]
	exponent := uint64(0)
	if match[3] != "" {
		var err error
		exponent, err = strconv.ParseUint(match[3], 10, 64)
		if err != nil {
			return coinpkg.Amount{}, false
		}
	}
	if exponent < uint64(len(fraction)) {
		return coinpkg.Amount{}, false
	}

	significantDigits := strings.TrimLeft(match[1]+fraction, "0")
	if significantDigits == "" {
		return coinpkg.NewAmountFromInt64(0), true
	}
	trailingZeros := exponent - uint64(len(fraction))
	// Bound the input before passing the untrusted value to the amount parser. A non-zero uint256
	// has at most 78 decimal digits and cannot have more than 77 trailing decimal zeros.
	if trailingZeros > 77 || len(significantDigits) > 78-int(trailingZeros) {
		return coinpkg.Amount{}, false
	}
	boundedAmountString := significantDigits
	if trailingZeros > 0 {
		boundedAmountString += "e" + strconv.FormatUint(trailingZeros, 10)
	}
	atomicAmount, err := coinpkg.NewAmountFromString(boundedAmountString, big.NewInt(1))
	if err != nil || atomicAmount.BigInt().BitLen() > 256 {
		return coinpkg.Amount{}, false
	}
	return atomicAmount, true
}
