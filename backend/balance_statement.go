// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"
	_ "embed"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"time"

	"codeberg.org/go-pdf/fpdf"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/eth"
	utilcfg "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

const errSepoliaBalanceStatementUnsupported errp.ErrorCode = "sepoliaBalanceStatementUnsupported"

type statementRow struct {
	coinName         string
	amount           string
	unit             string
	fiatValue        string
	hasEstimatedFiat bool
}

// ExportBalanceStatement exports a PDF statement for the selected active accounts
// at the provided snapshot date.
func (backend *Backend) ExportBalanceStatement(
	accountCodes []accountsTypes.Code,
	snapshotDate time.Time,
) error {
	snapshotStart := time.Date(
		snapshotDate.Year(),
		snapshotDate.Month(),
		snapshotDate.Day(),
		0, 0, 0, 0,
		snapshotDate.Location(),
	)
	now := time.Now()
	if snapshotStart.After(now) {
		return errp.New("the snapshot date must not be in the future")
	}
	snapshotEnd := snapshotStart.AddDate(0, 0, 1).Add(-time.Nanosecond)
	// A snapshot of the current day is effectively "as of now": historical rates
	// do not exist yet for the remainder of the day, so the latest rates are
	// used instead.
	isCurrentDay := snapshotEnd.After(now)
	if isCurrentDay {
		snapshotEnd = now
	}

	accountsByCode := map[accountsTypes.Code]accounts.Interface{}
	accountViews := backend.Accounts()
	for index := range accountViews {
		accountView := &accountViews[index]
		if accountView.Record.Inactive || accountView.Record.HiddenBecauseUnused {
			continue
		}
		accountsByCode[accountView.Record.Code] = accountView.Account
	}

	selectedAccounts := make([]accounts.Interface, 0, len(accountCodes))
	seen := make(map[accountsTypes.Code]struct{}, len(accountCodes))
	for _, accountCode := range accountCodes {
		if _, exists := seen[accountCode]; exists {
			continue
		}
		seen[accountCode] = struct{}{}
		account, ok := accountsByCode[accountCode]
		if !ok {
			return errp.Newf("account %s is not active", accountCode)
		}
		if account.FatalError() {
			return errp.Newf("account %s is not available", accountCode)
		}
		// Sepolia's provider does not support historical balances. Its ordinary
		// balance endpoint ignores historical block tags and returns the latest balance.
		if account.Coin().Code() == coinpkg.CodeSEPETH {
			return errp.WithStack(errSepoliaBalanceStatementUnsupported)
		}
		selectedAccounts = append(selectedAccounts, account)
	}
	if len(selectedAccounts) == 0 {
		return errp.New("no accounts selected")
	}

	fiat := backend.Config().AppConfig().Backend.MainFiat

	totalByCoin := make(map[coinpkg.Code]*big.Int)
	for _, account := range selectedAccounts {
		if err := account.Initialize(); err != nil {
			return errp.WithMessage(err,
				fmt.Sprintf("failed to initialize account %s", account.Config().Code))
		}
		balanceAtDate, err := balanceAtSnapshotDate(account, snapshotEnd)
		if err != nil {
			return errp.WithMessage(err,
				fmt.Sprintf("failed to determine the balance of account %s at the snapshot date",
					account.Config().Code))
		}
		coinCode := account.Coin().Code()
		if _, exists := totalByCoin[coinCode]; !exists {
			totalByCoin[coinCode] = big.NewInt(0)
		}
		totalByCoin[coinCode].Add(totalByCoin[coinCode], balanceAtDate.BigInt())
	}

	rows := make([]statementRow, 0, len(totalByCoin))
	totalFiat := new(big.Rat)
	hasMissingFiat := false
	hasEstimatedFiat := false
	for coinCode, totalAmountInt := range totalByCoin {
		coin, err := backend.Coin(coinCode)
		if err != nil {
			return err
		}
		totalAmount := coinpkg.NewAmount(totalAmountInt)
		row := statementRow{
			coinName: coin.Name(),
			amount:   coin.FormatAmount(totalAmount, false),
			unit:     coin.GetFormatUnit(false),
		}

		var priceAtSnapshot float64
		if !isCurrentDay {
			priceAtSnapshot = backend.RatesUpdater().HistoricalPriceAt(string(coinCode), fiat, snapshotEnd)
		}
		amountRat := new(big.Rat).SetFrac(totalAmountInt, coinpkg.DecimalsExp(coin, false))
		switch {
		case totalAmountInt.Sign() == 0:
			row.fiatValue = coinpkg.FormatAsCurrency(new(big.Rat), fiat)
		case priceAtSnapshot > 0:
			fiatValue := new(big.Rat).Mul(amountRat, new(big.Rat).SetFloat64(priceAtSnapshot))
			row.fiatValue = coinpkg.FormatAsCurrency(fiatValue, fiat)
			totalFiat.Add(totalFiat, fiatValue)
		case isCurrentDay || time.Since(snapshotEnd) < 2*time.Hour:
			latestPrice, err := backend.RatesUpdater().LatestPriceForPair(coin.Unit(false), fiat)
			if err == nil && latestPrice > 0 {
				fiatValue := new(big.Rat).Mul(amountRat, new(big.Rat).SetFloat64(latestPrice))
				row.fiatValue = coinpkg.FormatAsCurrency(fiatValue, fiat)
				row.hasEstimatedFiat = true
				totalFiat.Add(totalFiat, fiatValue)
				hasEstimatedFiat = true
				break
			}
			row.fiatValue = "N/A"
			hasMissingFiat = true
		default:
			row.fiatValue = "N/A"
			hasMissingFiat = true
		}

		rows = append(rows, row)
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].coinName < rows[j].coinName })
	totalFiatLabel := coinpkg.FormatAsCurrency(totalFiat, fiat)
	if hasMissingFiat {
		totalFiatLabel = "N/A"
	}

	pdfBytes, err := createBalanceStatementPDF(
		rows,
		fiat,
		totalFiatLabel,
		snapshotStart,
		hasMissingFiat,
		hasEstimatedFiat,
	)
	if err != nil {
		return errp.WithMessage(err, "failed to create the balance statement PDF")
	}

	exportsDir, err := utilcfg.ExportsDir()
	if err != nil {
		return err
	}
	filename := fmt.Sprintf("%s-balance-statement.pdf", time.Now().Format("2006-01-02-at-15-04-05"))
	suggestedPath := filepath.Join(exportsDir, filename)
	path := backend.Environment().GetSaveFilename(suggestedPath)
	if path == "" {
		return errp.ErrUserAbort
	}
	if err := utilcfg.EnsurePrivateFileIfExists(path); err != nil {
		return errp.WithMessage(err, "failed to restrict the balance statement PDF permissions")
	}
	if err := os.WriteFile(path, pdfBytes, utilcfg.PrivateFileMode); err != nil {
		return errp.WithMessage(err, "failed to write the balance statement PDF")
	}
	// Open the generated PDF for immediate feedback to the user.
	if err := backend.environment.SystemOpen(path); err != nil {
		// On mobile we expect this to work; on desktop it should also work in normal environments.
		// Keep this as a hard error so the frontend can surface the issue.
		return errp.WithMessage(err, "failed to open the balance statement PDF")
	}
	return nil
}

func balanceAtSnapshotDate(
	account accounts.Interface,
	snapshotEnd time.Time,
) (coinpkg.Amount, error) {
	if ethAccount, ok := account.(*eth.Account); ok {
		return ethAccount.BalanceAtTime(snapshotEnd)
	}
	txs, err := account.Transactions()
	if err != nil {
		return coinpkg.Amount{}, err
	}
	// Transactions are ordered newest first, with cumulative balances. The first
	// confirmed entry at or before the cutoff already includes all earlier transactions.
	for _, tx := range txs {
		if tx.Height <= 0 {
			continue
		}
		if tx.Timestamp == nil {
			return coinpkg.Amount{}, errp.New("confirmed transaction timestamp unavailable")
		}
		if tx.Timestamp.After(snapshotEnd) {
			continue
		}
		return tx.Balance, nil
	}
	return coinpkg.NewAmountFromInt64(0), nil
}

// balanceStatementLogo is the BitBox logomark and wordmark at print resolution.
//
//go:embed assets/bitbox-logo.png
var balanceStatementLogo []byte

func createBalanceStatementPDF(
	rows []statementRow,
	fiat string,
	totalFiat string,
	snapshotDate time.Time,
	hasMissingFiat bool,
	hasEstimatedFiat bool,
) ([]byte, error) {
	const (
		pageWidth     = 595.0
		pageHeight    = 842.0
		marginLeft    = 40.0
		marginRight   = 555.0
		amountColumn  = 170.0
		tableTopFirst = 262.0
		tableTopNext  = 122.0
		rowStep       = 39.0
		contentBottom = 712.0
		footerY       = 796.0
	)

	pdf := fpdf.NewCustom(&fpdf.InitType{
		OrientationStr: "P",
		UnitStr:        "pt",
		Size:           fpdf.SizeType{Wd: pageWidth, Ht: pageHeight},
	})
	pdf.SetCompression(false)
	// Rows, totals and footnotes are kept together using the report's own page boundaries.
	pdf.SetAutoPageBreak(false, 0)
	pdf.RegisterImageOptionsReader("bitbox-logo", fpdf.ImageOptions{ImageType: "PNG"},
		bytes.NewReader(balanceStatementLogo))
	encodeText := pdf.UnicodeTranslatorFromDescriptor("")
	text := func(x, y, size float64, style, value string) {
		pdf.SetFont("Helvetica", style, size)
		pdf.Text(x, y, encodeText(value))
	}
	textRight := func(rightX, y, size float64, style, value string) {
		pdf.SetFont("Helvetica", style, size)
		value = encodeText(value)
		pdf.Text(rightX-pdf.GetStringWidth(value), y, value)
	}
	pdf.SetFooterFunc(func() {
		pdf.SetTextColor(153, 153, 153)
		pdf.SetFont("Helvetica", "", 10)
		const disclaimer = "Disclaimer: This is an auto-generated report. Check information is correct."
		pdf.Text((pageWidth-pdf.GetStringWidth(disclaimer))/2, footerY, disclaimer)
	})
	newPage := func() float64 {
		pdf.AddPage()
		pdf.ImageOptions("bitbox-logo", marginLeft, 39, 150, 37, false, fpdf.ImageOptions{}, 0, "")
		pdf.SetTextColor(25, 25, 25)
		tableTop := tableTopNext
		if pdf.PageNo() == 1 {
			tableTop = tableTopFirst
			const titleLead = "Balance of assets as of "
			text(marginLeft, 197, 15, "", titleLead)
			text(marginLeft+pdf.GetStringWidth(titleLead), 197, 15, "B", snapshotDate.Format("02.01.2006"))
		}
		text(marginLeft, tableTop, 12, "B", "Asset")
		text(amountColumn, tableTop, 12, "B", "Amount")
		textRight(marginRight, tableTop, 12, "B", fmt.Sprintf("Value (%s)", fiat))
		pdf.SetDrawColor(25, 25, 25)
		pdf.SetLineWidth(1)
		pdf.Line(marginLeft, tableTop+14, marginRight, tableTop+14)
		return tableTop + 44
	}

	y := newPage()
	for _, row := range rows {
		if y > contentBottom {
			y = newPage()
		}
		fiatValue := row.fiatValue
		if row.hasEstimatedFiat {
			fiatValue += "*"
		}
		text(marginLeft, y, 11, "", row.coinName)
		text(amountColumn, y, 11, "", fmt.Sprintf("%s %s", row.amount, row.unit))
		textRight(marginRight, y, 11, "", fiatValue)
		y += rowStep
	}

	// Reserve space for the total and both possible footnotes.
	if y > contentBottom-30 {
		y = newPage()
	}
	y -= rowStep - 20
	pdf.SetDrawColor(217, 217, 217)
	pdf.SetLineWidth(0.75)
	pdf.Line(marginLeft, y, marginRight, y)
	y += 24
	text(marginLeft, y, 11, "B", "Total")
	textRight(marginRight, y, 11, "B", totalFiat)

	pdf.SetTextColor(153, 153, 153)
	y += 30
	if hasEstimatedFiat {
		text(marginLeft, y, 9, "",
			"* Latest rates were used because historical rates were not yet available.")
		y += 14
	}
	if hasMissingFiat {
		text(marginLeft, y, 9, "",
			"Some values were unavailable for the selected snapshot date and are shown as N/A.")
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, errp.WithStack(err)
	}
	return buf.Bytes(), nil
}
