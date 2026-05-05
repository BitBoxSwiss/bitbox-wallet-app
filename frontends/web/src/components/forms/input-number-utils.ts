// SPDX-License-Identifier: Apache-2.0

const decimalSeparator = /[,.]/;
const digits = /[^\d]/g;

export const numberInputValueToString = (
  value: string | number | readonly string[] | undefined
) => {
  if (value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join('');
  }
  return String(value);
};

export const sanitizeNumberInputValue = (value: string) => {
  const decimalIndex = value.search(decimalSeparator);
  if (decimalIndex === -1) {
    return value.replace(digits, '');
  }

  return [
    value.slice(0, decimalIndex).replace(digits, ''),
    value[decimalIndex],
    value.slice(decimalIndex + 1).replace(digits, ''),
  ].join('');
};

export const normalizeNumberInputValue = (value: string) => (
  sanitizeNumberInputValue(value).replace(',', '.').replace(/[.]$/, '')
);
