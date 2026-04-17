// SPDX-License-Identifier: Apache-2.0

export const truncateMiddle = (
  value: string,
  leadingChars = 8,
  trailingChars = 8,
): string => {
  if (!value) {
    return '';
  }

  if (value.length <= leadingChars + trailingChars + 3) {
    return value;
  }

  return `${value.slice(0, leadingChars)}...${value.slice(-trailingChars)}`;
};
