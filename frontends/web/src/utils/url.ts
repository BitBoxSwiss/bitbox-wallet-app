// SPDX-License-Identifier: Apache-2.0

export const getURLOrigin = (uri: string): string | null => {
  try {
    return new URL(uri).origin;
  } catch (e) {
    return null;
  }
};