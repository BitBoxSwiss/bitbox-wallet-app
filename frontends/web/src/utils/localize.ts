// SPDX-License-Identifier: Apache-2.0

import type { TNumberFormat } from '@/api/nativelocale';

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
 * If a customFormat object with both decimal and group separators is provided,
 * the function overrides the locale's decimal and grouping separators while
 * preserving all other locale-specific formatting behavior.
 *
 * If the provided locale is invalid or Intl.NumberFormat initialization fails,
 * the function falls back to a `de-CH` percent formatter with two fraction digits.
 * Custom decimal and grouping separator overrides are still applied when provided.
 *
 * If no formatter can be created, the function falls back to:
 *
 *   (amount * 100).toFixed(2)
 *
 * @param amount - Decimal percentage value (e.g. 0.1532 for 15.32%)
 * @param locale - BCP 47 locale string used for number formatting
 * @param customFormat - Optional custom decimal and grouping separators.
 * Both separators must be provided for the override to be applied.
 * Overrides only the locale's decimal and group symbols while preserving all
 * other locale-specific formatting behavior.
 * @returns Localized percentage string without the percent symbol
 */
export const localizePercentage = (
  amount: number,
  locale: string,
  customFormat?: TNumberFormat,
): string => {

  const decimalSeparator = customFormat?.decimal;
  const groupSeparator = customFormat?.group;
  let formatter: Intl.NumberFormat | undefined;

  try {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      signDisplay: 'auto',
      style: 'percent',
    });
  } catch {
    try {
      // in case invalid locale / Intl formatting failures and fall back below
      formatter = Intl.NumberFormat('de-CH', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        signDisplay: 'auto',
        style: 'percent',
      });
    } catch {}
  }

  if (formatter) {
    return (
      formatter
        .formatToParts(amount)
        .filter(part => part.type !== 'percentSign')
        .map(part => {
          if (decimalSeparator !== undefined && groupSeparator !== undefined) {
            if (part.type === 'decimal') {
              return decimalSeparator;
            }
            if (part.type === 'group') {
              return groupSeparator;
            }
          }
          return part.value;
        })
        .join('')
        .trim()
    );
  }

  return (amount * 100).toFixed(2);
};
