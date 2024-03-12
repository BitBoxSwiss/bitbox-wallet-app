import { describe, expect, it } from 'vitest';
import { getDeviceNameValidationError } from './device';

describe('getDeviceNameValidationError', () => {
  it('returns undefined (no error) for an empty name', () => {
    expect(getDeviceNameValidationError('')).toBeUndefined();
    expect(getDeviceNameValidationError('   ')).toBeUndefined();
  });

  it('returns undefined (no error) for a valid name', () => {
    expect(getDeviceNameValidationError('My BitBox')).toBeUndefined();
    expect(getDeviceNameValidationError('BitBox123')).toBeUndefined();
  });

  it('returns "tooLong" for names longer than 30 characters', () => {
    const longName = 'ThisDeviceNameIsWayTooLongAndInvalid';
    expect(getDeviceNameValidationError(longName)).toEqual('tooLong');
  });

  it('returns "invalidChars" for names with invalid characters', () => {
    expect(getDeviceNameValidationError('MyDevicä')).toEqual('invalidChars');
    expect(getDeviceNameValidationError('MyDeviíïäá')).toEqual('invalidChars');
  });

  it('handles boundary conditions properly', () => {
    const validShortName = 'A';
    const validLongName = '123456789012345678901234567890';
    expect(getDeviceNameValidationError(validShortName)).toBeUndefined();
    expect(getDeviceNameValidationError(validLongName)).toBeUndefined();
  });
});
