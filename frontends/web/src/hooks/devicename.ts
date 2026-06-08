// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo } from 'react';
import { TDeviceNameError } from '@/utils/types';

// matches any character that is not a printable ASCII character or space
const regexInvalid = /[^ -~]/g;

export const useValidateDeviceName = (name: string) => {

  const getDeviceNameValidationError = useCallback((name: string): TDeviceNameError => {
    const trimmed = name.trim();
    regexInvalid.lastIndex = 0; // resets lastIndex before each test

    if (trimmed.length < 1) {
      return 'tooShort';
    }

    if (trimmed.length > 30) {
      return 'tooLong';
    }

    if (regexInvalid.test(trimmed)) {
      return 'invalidChars';
    }

  }, []);

  const getInvalidCharsInDeviceName = useCallback((deviceName: string) => deviceName.match(regexInvalid)?.filter(filterUnique).join(', '), []);

  const { error, invalidChars, nameIsTooShort } = useMemo(() => {
    const error = getDeviceNameValidationError(name);
    const invalidChars = getInvalidCharsInDeviceName(name);
    const nameIsTooShort = error === 'tooShort';
    return { error, invalidChars, nameIsTooShort };
  }, [getDeviceNameValidationError, getInvalidCharsInDeviceName, name]);


  const filterUnique = (value: string, index: number, array: string[]) => {
    return array.indexOf(value) === index;
  };

  return { error, invalidChars, nameIsTooShort };
};