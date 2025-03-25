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

export const localizePercentage = (amount: number, locale: string): string => {
  let formatter;

  try {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      signDisplay: 'auto',
      style: 'percent',
    });
  } catch (error) {}

  if (formatter) {
    return formatter.format(amount).replace('%', '').trim();
  }

  return (amount * 100).toFixed(2);
};
