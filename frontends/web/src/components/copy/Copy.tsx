/**
 * Copyright 2018 Shift Devices AG
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
}: TProps) => {
  const [success, setSuccess] = useState(false);
  const { t } = useTranslation();

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHeight();
  }, []);

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
      'flex flex-row flex-start flex-items-start',
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

