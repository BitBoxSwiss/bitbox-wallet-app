// SPDX-License-Identifier: Apache-2.0

/**
 * useDefault is a hook to provide a default value to a value that can be undefined.
 */
export const useDefault = <T>(value: T | undefined, defaultValue: T): T => {
  return value !== undefined ? value : defaultValue;
};
