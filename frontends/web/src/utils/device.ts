export type TDeviceNameError = undefined | 'tooLong' | 'invalidChars'

// matches any character that is not a printable ASCII character or space
export const regexInvalid = /[^ -~]/g;

export const getDeviceNameValidationError = (name: string): TDeviceNameError => {
  const trimmed = name.trim();
  regexInvalid.lastIndex = 0; // resets lastIndex before each test

  if (trimmed.length < 1) {
    return undefined;
  }

  if (trimmed.length > 30) {
    return 'tooLong';
  }

  if (regexInvalid.test(trimmed)) {
    return 'invalidChars';
  }

};

export const getInvalidCharsInDeviceName = (deviceName: string) => deviceName.match(regexInvalid)?.filter(filterUnique).join(', ');

const filterUnique = (value: string, index: number, array: string[]) => {
  return array.indexOf(value) === index;
};