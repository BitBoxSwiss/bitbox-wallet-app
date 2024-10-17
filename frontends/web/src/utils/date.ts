/**
 * Copyright 2022-2024 Shift Crypto AG
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

export const convertDateToLocaleString = (
  date: string,
  language: string
) => {
  return new Date(date).toLocaleString(language, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const parseTimeShort = (
  time: string,
  locale: string,
) => {
  const date = new Date(Date.parse(time));
  // Check if in the current year (UTC)
  if (date.getUTCFullYear() === new Date().getUTCFullYear()) {
    return (
      date.toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
      })
    );
  }
  return (
    date.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  );
};

export const parseTimeLong = (
  time: string,
  locale: string
) => {
  const date = new Date(Date.parse(time));
  // Check if in the current year (UTC)
  if (date.getUTCFullYear() === new Date().getUTCFullYear()) {
    return (
      date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
      })
    );
  }
  return (
    date.toLocaleString(locale, {
      dateStyle: 'full',
    })
  );
};

export const parseTimeLongWithYear = (
  time: string,
  locale: string
) => {
  const date = new Date(Date.parse(time));
  return date.toLocaleString(locale, {
    dateStyle: 'full',
  });
};
