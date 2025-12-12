// SPDX-License-Identifier: Apache-2.0

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
