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

import { useDarkmode } from '../../hooks/darkmode';

let darkmode: boolean | undefined;

export const setDarkmode = (dark: boolean) => {
  if (dark) {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
  } else {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
  }
  darkmode = dark;
};

export const Darkmode = () => {
  const mode = useDarkmode();
  setDarkmode(mode);
  return null;
};

/**
 * get darkmode, only usefull for conditional rendering
 * @returns {boolean} darkmode
 */
export const getDarkmode = () => darkmode;
