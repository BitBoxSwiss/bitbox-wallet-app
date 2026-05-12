// SPDX-License-Identifier: Apache-2.0

/**
 * Formats a decimal value as a localized percentage string without the percent symbol.
 *
 * Examples:
 * - localizePercentage(0.1532, 'en-US') => "15.32"
 * - localizePercentage(0.1532, 'de-DE') => "15,32"
 * - localizePercentage(15.3212, 'de-CH') => "1’532.12"
 *
 * The function uses Intl.NumberFormat with `style: 'percent'`, which means:
 * - the input value is multiplied by 100 automatically
 * - locale-specific decimal and thousands separators are applied
 * - the output is rounded to exactly 2 decimal places
 *
 * The percent sign produced by Intl is removed from the final result.
 *
 * If the provided locale is invalid or Intl.NumberFormat fails,
 * the function falls back to a simple non-localized percentage format:
 *
 *   (amount * 100).toFixed(2)
 *
 * @param amount - Decimal percentage value (e.g. 0.1532 for 15.32%)
 * @param locale - BCP 47 locale string used for number formatting
 * @returns Localized percentage string without the percent symbol
 */
export const localizePercentage = (
  amount: number,
  locale: string,
): string => {

  let formatter;

  try {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      signDisplay: 'auto',
      style: 'percent',
    });
  } catch (error) {
  }

  if (formatter) {
    return (
      formatter
        .format(amount)
        .replace('%', '')
        .trim()
    );
  }

  return (amount * 100).toFixed(2);
};
