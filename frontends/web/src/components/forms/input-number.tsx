// SPDX-License-Identifier: Apache-2.0

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { Input, TInputProps } from './input';
import { normalizeNumberInputValue, numberInputValueToString, sanitizeNumberInputValue } from './input-number-utils';
import { runningInIOS } from '@/utils/env';

type Props = Omit<TInputProps, 'ref' | 'onInput' | 'onChange'> & {
  onChange?: (value: string) => void;
};

export const NumberInput = forwardRef<HTMLInputElement, Props>(({
  inputMode = 'decimal',
  onChange,
  value,
  defaultValue,
  ...props
}: Props, ref) => {
  const isIOS = runningInIOS();
  const reportedValue = useRef(numberInputValueToString(value === undefined ? defaultValue : value));
  const [displayValue, setDisplayValue] = useState(
    numberInputValueToString(value === undefined ? defaultValue : value)
  );

  useEffect(() => {
    if (value === undefined) {
      return;
    }
    const nextValue = numberInputValueToString(value);
    if (nextValue !== reportedValue.current) {
      setDisplayValue(nextValue);
    }
    reportedValue.current = nextValue;
  }, [value]);

  // support pasting of various different formats
  // the function tries to do some light string replacement and see if it becomes a number
  // if NaN it tries to detect and change a few commonly localized formats
  // 100,50 should become 100.50, and not 10050
  // more examples in the condition
  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    if (!event.currentTarget || !event.clipboardData) {
      return;
    }
    const text = (
      event.clipboardData
        .getData('text')
        .trim()
        // remove thousand separator characters space (fr, ru, sw) and apostrophe (ch, li)
        .replace(/[ ']/g, '')
    );

    const target = event.currentTarget;
    const dividedByComma = text.split(',');
    const dividedByDot = text.split('.');
    // see if this would turn to a valid number
    const value = Number(text);
    if (value && !Number.isNaN(value)) {
      // valid number, stop here and let paste event continue
      target.value = text;
    } else if (
      // comma decimal separator 100,50 or ,99
      dividedByComma.length === 2
      && dividedByDot.length === 1
    ) {
      target.value = dividedByComma.join('.');
    } else if (
      // comma decimal with dot thousand separator i.e. 1.000.000,50 (de, es, it)
      dividedByComma.length === 2
      && dividedByDot.length > 1
      && dividedByDot[dividedByDot.length - 1]?.includes(',')
    ) {
      target.value = [
        dividedByComma[0]?.replace(/[.]/g, ''), // replace dot in whole coins 1.000.000
        dividedByComma[1], // rest i.e. 50
      ].join('.');
    } else if (
      // dot decimal with comma thousand separator i.e. 1,000,000.50 (cn, jp, us)
      dividedByDot.length === 2
      && dividedByComma.length > 1
      && dividedByComma[dividedByComma.length - 1]?.includes('.')
    ) {
      target.value = [
        dividedByDot[0]?.replace(/[,]/g, ''), // replace comma in 1,000,000
        dividedByDot[1], // rest i.e. 50
      ].join('.');
    } else {
      console.warn(`unexpected format ${text.replace(/[\d]/g, '9')}`);
      return;
    }
    if (isIOS) {
      setDisplayValue(target.value);
      reportedValue.current = target.value;
    }
    if (onChange) {
      onChange(target.value);
    }
    event.preventDefault();
  }, [isIOS, onChange]);

  const handleIOSInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.currentTarget;
    const sanitizedValue = sanitizeNumberInputValue(target.value);
    const normalizedValue = normalizeNumberInputValue(sanitizedValue);
    setDisplayValue(sanitizedValue);
    reportedValue.current = normalizedValue;
    if (onChange) {
      onChange(normalizedValue);
    }
  }, [onChange]);

  return (
    <Input
      {...props}
      ref={ref}
      type={isIOS ? 'text' : 'number'}
      inputMode={inputMode}
      value={isIOS ? displayValue : value}
      defaultValue={isIOS ? undefined : defaultValue}
      onInput={isIOS ? handleIOSInput : (
        onChange ? (e) => onChange(e.currentTarget.value) : undefined
      )}
      onPaste={handlePaste}
    />
  );
});
