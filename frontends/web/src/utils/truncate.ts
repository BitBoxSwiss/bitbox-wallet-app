// SPDX-License-Identifier: Apache-2.0

export const truncateMiddle = (
  value: string,
  prefixLength: number,
  suffixLength: number,
  separator = '...',
): string => {
  if (!value || value.length <= prefixLength + suffixLength) {
    return value ?? '';
  }
  return `${value.slice(0, prefixLength)}${separator}${value.slice(-suffixLength)}`;
};
