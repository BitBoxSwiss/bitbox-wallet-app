// SPDX-License-Identifier: Apache-2.0

import { useDarkmode } from '@/hooks/darkmode';

let darkmode: boolean | undefined;

export const Darkmode = () => {
  const { isDarkMode } = useDarkmode();
  darkmode = isDarkMode;
  return null;
};
/**
 * Retrieve dark mode state for
 * conditional rendering in class
 * components. Use `useDarkmode`
 * hook for functional components.
 * @returns {boolean} darkmode
 */
export const getDarkmode = () => darkmode;
