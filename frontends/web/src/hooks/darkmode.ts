// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { DarkModeContext } from '@/contexts/DarkmodeContext';

/**
Hook that manages the app's dark mode state.
For class components, use `getDarkmode()`.
@return {Object} An object with a boolean `isDarkMode`
which is the dark mode state of the app, and
`toggleDarkMode` function to toggle the state.
*/
export const useDarkmode = () => {
  const { isDarkMode, toggleDarkmode } = useContext(DarkModeContext);
  return { isDarkMode, toggleDarkmode };
};
