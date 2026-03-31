// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from '@/components/icon/icon';
import style from './Copy.module.css';

type TProps = {
  alignLeft?: boolean;
  alignRight?: boolean;
  borderLess?: boolean;
  className?: string;
  inputFieldClassName?: string;
  buttonClassName?: string;
  disabled?: boolean;
  flexibleHeight?: boolean;
  displayValue?: string;
  value: string;
  dataTestId?: string;
};

export const CopyableInput = ({
  alignLeft,
  alignRight,
  borderLess,
  value,
  className,
  inputFieldClassName,
  buttonClassName,
  disabled,
  flexibleHeight,
  displayValue,
  dataTestId,
}: TProps) => {
  const [success, setSuccess] = useState(false);
  const { t } = useTranslation();

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHeight();
  }, [displayValue, value]);

  useEffect(() => {
    if (success) {
      setTimeout(() => setSuccess(false), 1500);
    }
  }, [success]);

  const setHeight = () => {
    const textarea = textAreaRef.current;
    if (!textarea) {
      return;
    }
    const fontSize = window.getComputedStyle(textarea, null).getPropertyValue('font-size');
    const units = Number(fontSize.replace('px', '')) + 2;
    textarea.setAttribute('rows', '1');
    textarea.setAttribute('rows', String(Math.round((textarea.scrollHeight / units) - 2)));
  };

  const onFocus = (e: React.SyntheticEvent<HTMLTextAreaElement, FocusEvent>) => {
    e.currentTarget.focus();
  };

  const copy = () => {
    if (textAreaRef.current) {
      if (displayValue) {
        navigator.clipboard.writeText(value);
      } else {
        navigator.clipboard.writeText(textAreaRef.current.value);

      }
      setSuccess(true);
    }
  };


  return (
    <div className={[
      style.container,
      className ? className : ''
    ].join(' ')}>
      <textarea
        disabled={disabled}
        readOnly
        onFocus={onFocus}
        value={displayValue ? displayValue : value}
        ref={textAreaRef}
        rows={1}
        {...(dataTestId ? { 'data-testid': dataTestId } : {})}
        className={`${style.inputField || ''}
          ${flexibleHeight ? style.flexibleHeight || '' : ''}
          ${alignLeft ? style.alignLeft || '' : ''}
          ${alignRight ? style.alignRight || '' : ''}
          ${borderLess ? style.borderLess || '' : ''}
          ${inputFieldClassName ? inputFieldClassName : ''}
        `} />
      {disabled ? null : (
        <button
          onClick={copy}
          className={`
          ${style.button || ''}
          ${success ? style.success || '' : ''}
          ${buttonClassName ? buttonClassName : ''}
           ignore`}
          title={t('button.copy')}>
          {success ? <Check /> : <Copy />}
        </button>
      )}
    </div>
  );
};
