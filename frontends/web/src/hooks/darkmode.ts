/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useContext } from 'react';
import { DarkModeContext } from '../contexts/DarkmodeContext';

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
