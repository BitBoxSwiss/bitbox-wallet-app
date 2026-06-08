// SPDX-License-Identifier: Apache-2.0

export const truncateMiddle = (
  value: string,
  prefixLength: number,
  suffixLength: number,
  separator = '...',
): string => {
  if (prefixLength < 0 || suffixLength < 0) {
    throw new Error('prefixLength and suffixLength must be non-negative');
  }
  if (value.length <= prefixLength + suffixLength) {
    return value;
  }
  return `${value.slice(0, prefixLength)}${separator}${value.slice(-suffixLength)}`;
};
