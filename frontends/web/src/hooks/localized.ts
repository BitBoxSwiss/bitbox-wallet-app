/**
 * Copyright 2024 Shift Crypto AG
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

import { useMemo } from 'react';

export const useLocalizedPunctuation = (
  // fallback to 'en-US' if native locale is an empty string
  locale = 'en-US'
) => {

  const { decimal, group } = useMemo(() => {
    // defaults
    let decimal = '.';
    let group = '’';
    // try to find decimal and group separators for locale
    try {
      const parts = (
        Intl
          .NumberFormat(locale, { style: 'currency', currency: 'USD' })
          .formatToParts(1234567.89)
      );
      decimal = parts.find(part => part.type === 'decimal')?.value || decimal;
      group = parts.find(part => part.type === 'group')?.value || group;
    } catch (error) {
      console.warn(error);
    }
    return { decimal, group };
  }, [locale]);

  return { decimal, group };
};
