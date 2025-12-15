// SPDX-License-Identifier: Apache-2.0

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
