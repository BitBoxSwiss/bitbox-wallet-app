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

// shortens a backend-formatted address (space-separated groups) for display.
// takes the first 2 and last 2 groups with "..." in between.
// short addresses (<=4 groups) are returned as-is.
export const truncateDisplayAddress = (displayAddress: string): string => {
  const groups = displayAddress.split(/\s+/).filter(Boolean);
  if (groups.length <= 4) {
    return displayAddress;
  }
  const start = groups.slice(0, 2).join(' ');
  const end = groups.slice(-2).join(' ');
  return `${start} ... ${end}`;
};
