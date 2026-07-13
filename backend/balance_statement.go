// SPDX-License-Identifier: Apache-2.0

package backend

import (
	"bytes"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts"
	accountsTypes "github.com/BitBoxSwiss/bitbox-wallet-app/backend/accounts/types"
	coinpkg "github.com/BitBoxSwiss/bitbox-wallet-app/backend/coins/coin"
	utilcfg "github.com/BitBoxSwiss/bitbox-wallet-app/util/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
)

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

	accountsByCode := map[accountsTypes.Code]accounts.Interface{}
	for _, account := range backend.Accounts() {
		config := account.Config().Config
		if config.Inactive || config.HiddenBecauseUnused {
			continue
		}
		accountsByCode[config.Code] = account
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
				fmt.Sprintf("failed to initialize account %s", account.Config().Config.Code))
		}
		balanceAtDate, err := balanceAtSnapshotDate(account, snapshotEnd)
		if err != nil {
			return errp.WithMessage(err,
				fmt.Sprintf("failed to determine the balance of account %s at the snapshot date",
					account.Config().Config.Code))
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
	if err := os.WriteFile(path, pdfBytes, 0o644); err != nil {
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
	txs, err := account.Transactions()
	if err != nil {
		return coinpkg.Amount{}, err
	}
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

// PDF page geometry (A4 portrait, in points) and shared style constants.
const (
	pdfPageWidth   = 595.0
	pdfPageHeight  = 842.0
	pdfMarginLeft  = 40.0
	pdfMarginRight = 555.0

	// pdfInk is the near-black used for the logo, text and the table rule,
	// matching the #191919 of the BitBox logo.
	pdfInk = "0.098"
	// pdfGray is used for the disclaimer footer and footnotes.
	pdfGray = "0.6"

	pdfFontRegular = "F1"
	pdfFontBold    = "F2"
)

// bitboxLogoPath is the path data of the BitBox logo (logomark + wordmark) taken
// unmodified from the official SVG with viewBox "0 0 150 37" and even-odd fill.
const bitboxLogoPath = "M65.1288 23.8476C65.1288 28.2506 62.131 30.9491 57.3699 30.9491H44.7791V5.73855H56.6996C61.1081 5.73855 64.247 8.10579 64.247 12.2366C64.3499 14.7386 62.7517 16.9915 60.3675 17.7048C63.4359 18.6634 65.1288 20.6874 65.1288 23.8476ZM55.6064 27.1144C58.6041 27.1144 60.1911 25.7651 60.1911 23.457C60.1911 21.1491 58.5689 19.7642 55.6064 19.7642H49.7284V27.1144H55.6064ZM49.7284 15.8939H55.5005C58.0399 15.8939 59.4506 14.7104 59.4506 12.6271C59.4506 10.5439 58.1457 9.57356 55.5359 9.57356H49.7167L49.7284 15.8939ZM72.9111 5.73855V10.3546H68.3264V5.73855H72.9111ZM72.9111 12.8046V30.9491H68.3264V12.8046H72.9111ZM87.3828 30.7007C86.0776 31.1516 84.7068 31.3795 83.3269 31.3752C79.8002 31.3752 78.2131 29.7063 78.2131 26.2622V16.3199H75.0037V12.8401H78.2129V7.19439H82.7979V12.8401H87.1006V16.3908H82.7979V25.7649C82.7979 27.0077 83.3268 27.4338 84.5965 27.4338C85.3613 27.3926 86.1189 27.2615 86.8535 27.0432L87.3828 30.7007ZM110.612 23.8476C110.612 28.2506 107.615 30.9491 102.854 30.9491H90.216V5.73855H102.136C106.545 5.73855 109.684 8.10579 109.684 12.2366C109.787 14.7386 108.189 16.9915 105.804 17.7048C108.873 18.6634 110.612 20.6874 110.612 23.8476ZM95.1652 15.8939H100.949C103.488 15.8939 104.899 14.7104 104.899 12.6271C104.899 10.5439 103.559 9.57356 100.973 9.57356H95.1535L95.1652 15.8939ZM101.043 27.1144C104.041 27.1144 105.628 25.7651 105.628 23.457C105.628 21.1491 104.006 19.7642 101.043 19.7642H95.1652V27.1144H101.043ZM131.491 21.8593C131.491 27.6115 127.576 31.5173 122.086 31.5173C116.596 31.5173 112.682 27.6115 112.682 21.8593C112.682 16.1069 116.596 12.2011 122.086 12.2011C127.576 12.2011 131.491 16.1069 131.491 21.8593ZM117.384 21.8593C117.384 25.41 119.253 27.6115 122.086 27.6115C124.92 27.6115 126.789 25.3745 126.789 21.8593C126.789 18.3438 124.92 16.1069 122.086 16.1069C119.253 16.1069 117.384 18.4741 117.384 21.8593ZM144.576 30.9491L140.52 24.7353L136.429 30.9491H131.491L137.98 21.433L132.091 12.8046H137.063L140.59 18.1308L144.046 12.8046H148.972L143.165 21.2555L149.607 30.9491H144.576ZM-0.000499725 27.9786V19.3775L6.90003 16.3897V3.00244L13.743 0V21.9593L-0.000499725 27.9786ZM30.9294 28.0511L17.1717 22.0318V0.0725653L24.0289 3.08942V16.4622L30.9294 19.4646V28.0511ZM15.486 24.9761L29.2296 30.9809L15.4716 37L1.77138 31.0099L15.486 24.9761Z"

// Character advance widths (thousandths of the font size) for the PDF standard
// fonts Helvetica and Helvetica-Bold, covering ASCII 32-126, taken from the
// Adobe AFM core font metrics. Used to right-align and center text.
var helveticaWidths = [95]int{
	278, 278, 355, 556, 556, 889, 667, 222, 333, 333, 389, 584,
	278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
	556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722,
	722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
	667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
	278, 278, 469, 556, 222, 556, 556, 500, 556, 556, 278, 556,
	556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500,
	278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
}

var helveticaBoldWidths = [95]int{
	278, 333, 474, 556, 556, 889, 722, 278, 333, 333, 389, 584,
	278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
	556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722,
	722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
	667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
	278, 333, 584, 556, 278, 556, 611, 556, 611, 556, 333, 611,
	611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556,
	333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
}

// pdfTextWidth returns the rendered width in points of text at the given font
// size. Characters outside ASCII are measured as '?', mirroring pdfEscape.
func pdfTextWidth(text string, size float64, font string) float64 {
	widths := &helveticaWidths
	if font == pdfFontBold {
		widths = &helveticaBoldWidths
	}
	total := 0
	for _, r := range text {
		if r < 32 || r > 126 {
			r = '?'
		}
		total += widths[r-32]
	}
	return float64(total) * size / 1000
}

func createBalanceStatementPDF(
	rows []statementRow,
	fiat string,
	totalFiat string,
	snapshotDate time.Time,
	hasMissingFiat bool,
	hasEstimatedFiat bool,
) ([]byte, error) {
	const (
		amountColumn = 170.0
		// Baseline of the column header row on the first / continued pages.
		tableTopFirst = 580.0
		tableTopNext  = 720.0
		rowStep       = 39.0
		// Lowest y a table row may be drawn at before breaking the page.
		contentBottom = 130.0
		footerY       = 46.0
	)

	logoOps, err := svgPathToPDFOps(bitboxLogoPath, pdfMarginLeft, pdfPageHeight-39)
	if err != nil {
		return nil, err
	}

	var pages []string
	var ops []string
	addOp := func(s string) { ops = append(ops, s) }
	text := func(x, y, size float64, font, s string) {
		addOp(fmt.Sprintf("BT /%s %.2f Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET", font, size, x, y, pdfEscape(s)))
	}
	textRight := func(rightX, y, size float64, font, s string) {
		text(rightX-pdfTextWidth(s, size, font), y, size, font, s)
	}
	textCentered := func(centerX, y, size float64, font, s string) {
		text(centerX-pdfTextWidth(s, size, font)/2, y, size, font, s)
	}
	setTextGray := func(gray string) {
		addOp(gray + " g")
	}
	flushPage := func() {
		setTextGray(pdfGray)
		textCentered(pdfPageWidth/2, footerY, 10, pdfFontRegular,
			"Disclaimer: This is an auto-generated report. Check information is correct.")
		pages = append(pages, strings.Join(ops, "\n"))
		ops = nil
	}
	// newPage starts a page with the logo and the table column headers and
	// returns the baseline for the first table row.
	newPage := func(first bool) float64 {
		ops = nil
		addOp("q " + pdfInk + " g " + logoOps + " f* Q")
		setTextGray(pdfInk)
		tableTop := tableTopNext
		if first {
			tableTop = tableTopFirst
			const titleSize = 15.0
			titleLead := "Balance of assets as of "
			text(pdfMarginLeft, 645, titleSize, pdfFontRegular, titleLead)
			text(pdfMarginLeft+pdfTextWidth(titleLead, titleSize, pdfFontRegular), 645, titleSize,
				pdfFontBold, snapshotDate.Format("02.01.2006"))
		}
		text(pdfMarginLeft, tableTop, 12, pdfFontBold, "Asset")
		text(amountColumn, tableTop, 12, pdfFontBold, "Amount")
		textRight(pdfMarginRight, tableTop, 12, pdfFontBold, fmt.Sprintf("Value (%s)", fiat))
		addOp(fmt.Sprintf("%s G 1 w %.2f %.2f m %.2f %.2f l S",
			pdfInk, pdfMarginLeft, tableTop-14, pdfMarginRight, tableTop-14))
		return tableTop - 44
	}

	y := newPage(true)
	for _, row := range rows {
		if y < contentBottom {
			flushPage()
			y = newPage(false)
		}
		fiatValue := row.fiatValue
		if row.hasEstimatedFiat {
			fiatValue += "*"
		}
		text(pdfMarginLeft, y, 11, pdfFontRegular, row.coinName)
		text(amountColumn, y, 11, pdfFontRegular, fmt.Sprintf("%s %s", row.amount, row.unit))
		textRight(pdfMarginRight, y, 11, pdfFontRegular, fiatValue)
		y -= rowStep
	}

	// Total row, set off by a light rule.
	if y < contentBottom+30 {
		flushPage()
		y = newPage(false)
	}
	y += rowStep - 20
	addOp(fmt.Sprintf("0.85 G 0.75 w %.2f %.2f m %.2f %.2f l S",
		pdfMarginLeft, y, pdfMarginRight, y))
	y -= 24
	text(pdfMarginLeft, y, 11, pdfFontBold, "Total")
	textRight(pdfMarginRight, y, 11, pdfFontBold, totalFiat)

	// Footnotes about fiat values that could not be determined precisely.
	setTextGray(pdfGray)
	y -= 30
	if hasEstimatedFiat {
		text(pdfMarginLeft, y, 9, pdfFontRegular,
			"* Latest rates were used because historical rates were not yet available.")
		y -= 14
	}
	if hasMissingFiat {
		text(pdfMarginLeft, y, 9, pdfFontRegular,
			"Some values were unavailable for the selected snapshot date and are shown as N/A.")
	}

	flushPage()
	return buildSimplePDF(pages, pdfPageWidth, pdfPageHeight)
}

// svgPathToPDFOps converts SVG path data (absolute M/L/H/V/C/Z commands) to PDF
// path construction operators. SVG user units map 1:1 to PDF points and the
// path is placed with its SVG origin at (offsetX, offsetY) in PDF user space;
// the y axis is flipped, as SVG y grows downwards while PDF y grows upwards.
func svgPathToPDFOps(d string, offsetX, offsetY float64) (string, error) {
	tx := func(x float64) float64 { return offsetX + x }
	ty := func(y float64) float64 { return offsetY - y }

	pos := 0
	skipSeparators := func() {
		for pos < len(d) && (d[pos] == ' ' || d[pos] == ',' || d[pos] == '\t' || d[pos] == '\n' || d[pos] == '\r') {
			pos++
		}
	}
	number := func() (float64, error) {
		skipSeparators()
		start := pos
		if pos < len(d) && (d[pos] == '-' || d[pos] == '+') {
			pos++
		}
		for pos < len(d) && (d[pos] >= '0' && d[pos] <= '9' || d[pos] == '.') {
			pos++
		}
		if pos < len(d) && (d[pos] == 'e' || d[pos] == 'E') {
			pos++
			if pos < len(d) && (d[pos] == '-' || d[pos] == '+') {
				pos++
			}
			for pos < len(d) && d[pos] >= '0' && d[pos] <= '9' {
				pos++
			}
		}
		if start == pos {
			return 0, errp.Newf("svg path: expected number at offset %d", pos)
		}
		return strconv.ParseFloat(d[start:pos], 64)
	}
	numbers := func(count int) ([]float64, error) {
		values := make([]float64, count)
		for i := range values {
			value, err := number()
			if err != nil {
				return nil, err
			}
			values[i] = value
		}
		return values, nil
	}

	var ops []string
	var command byte
	var currentX, currentY, subpathStartX, subpathStartY float64
	for {
		skipSeparators()
		if pos >= len(d) {
			break
		}
		if c := d[pos]; c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' {
			command = c
			pos++
		} else if command == 'Z' {
			// Z takes no arguments, so repeating it would consume no input
			// and loop forever.
			return "", errp.Newf("svg path: unexpected data after Z at offset %d", pos)
		}
		// A digit or sign after a completed command repeats the previous
		// command; a repeated M is treated as L per the SVG specification.
		switch command {
		case 'M', 'L':
			coords, err := numbers(2)
			if err != nil {
				return "", err
			}
			op := "l"
			if command == 'M' {
				op = "m"
				subpathStartX, subpathStartY = coords[0], coords[1]
				command = 'L'
			}
			currentX, currentY = coords[0], coords[1]
			ops = append(ops, fmt.Sprintf("%.2f %.2f %s", tx(currentX), ty(currentY), op))
		case 'H':
			value, err := number()
			if err != nil {
				return "", err
			}
			currentX = value
			ops = append(ops, fmt.Sprintf("%.2f %.2f l", tx(currentX), ty(currentY)))
		case 'V':
			value, err := number()
			if err != nil {
				return "", err
			}
			currentY = value
			ops = append(ops, fmt.Sprintf("%.2f %.2f l", tx(currentX), ty(currentY)))
		case 'C':
			coords, err := numbers(6)
			if err != nil {
				return "", err
			}
			currentX, currentY = coords[4], coords[5]
			ops = append(ops, fmt.Sprintf("%.2f %.2f %.2f %.2f %.2f %.2f c",
				tx(coords[0]), ty(coords[1]), tx(coords[2]), ty(coords[3]), tx(coords[4]), ty(coords[5])))
		case 'Z':
			currentX, currentY = subpathStartX, subpathStartY
			ops = append(ops, "h")
		default:
			return "", errp.Newf("svg path: unsupported command %q", string(command))
		}
	}
	return strings.Join(ops, " "), nil
}

func buildSimplePDF(pageContents []string, pageWidth, pageHeight float64) ([]byte, error) {
	if len(pageContents) == 0 {
		return nil, errp.New("cannot build PDF without pages")
	}

	objectCount := 4 + len(pageContents)*2
	objects := make([]string, objectCount+1)

	objects[1] = "<< /Type /Catalog /Pages 2 0 R >>"

	pageRefs := make([]string, 0, len(pageContents))
	for i := range pageContents {
		pageObjID := 5 + i*2
		pageRefs = append(pageRefs, fmt.Sprintf("%d 0 R", pageObjID))
	}
	objects[2] = fmt.Sprintf(
		"<< /Type /Pages /Kids [%s] /Count %d >>",
		strings.Join(pageRefs, " "),
		len(pageContents),
	)
	objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
	objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"

	for i, content := range pageContents {
		pageObjID := 5 + i*2
		contentObjID := pageObjID + 1
		objects[pageObjID] = fmt.Sprintf(
			"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.0f %.0f] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>",
			pageWidth, pageHeight, contentObjID,
		)
		objects[contentObjID] = fmt.Sprintf(
			"<< /Length %d >>\nstream\n%s\nendstream",
			len([]byte(content)),
			content,
		)
	}

	var buf bytes.Buffer
	buf.WriteString("%PDF-1.4\n")

	offsets := make([]int, objectCount+1)
	for objectID := 1; objectID <= objectCount; objectID++ {
		offsets[objectID] = buf.Len()
		_, _ = fmt.Fprintf(&buf, "%d 0 obj\n%s\nendobj\n", objectID, objects[objectID])
	}

	xrefOffset := buf.Len()
	_, _ = fmt.Fprintf(&buf, "xref\n0 %d\n", objectCount+1)
	buf.WriteString("0000000000 65535 f \n")
	for objectID := 1; objectID <= objectCount; objectID++ {
		_, _ = fmt.Fprintf(&buf, "%010d 00000 n \n", offsets[objectID])
	}
	_, _ = fmt.Fprintf(
		&buf,
		"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n",
		objectCount+1,
		xrefOffset,
	)
	return buf.Bytes(), nil
}

func pdfEscape(input string) string {
	var b strings.Builder
	for _, r := range input {
		if r < 32 || r > 126 {
			r = '?'
		}
		switch r {
		case '\\', '(', ')':
			b.WriteRune('\\')
		}
		b.WriteRune(r)
	}
	return b.String()
}
