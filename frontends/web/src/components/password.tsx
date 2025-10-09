/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2024-2025 Shift Crypto AG
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

import { useEffect, useRef, useState, ChangeEvent, ClipboardEvent, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCapsLock } from '@/hooks/keyboard';
import { Input, Checkbox, Field } from './forms';
import { alertUser } from './alert/Alert';
import style from './password.module.css';


type TPropsPasswordInput = {
  seePlaintext?: boolean;
  id?: string;
  label: string;
  placeholder?: string;
  onInput?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
};

export const PasswordInput = ({ seePlaintext, ...rest }: TPropsPasswordInput) => {
  return (
    <Input
      type={seePlaintext ? 'text' : 'password'}
      {...rest}
    />
  );
};

type TProps = {
  pattern?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  title?: string;
  showLabel?: string;
  onValidPassword: (password: string | null) => void;
};

export const PasswordSingleInput = ({
  pattern,
  autoFocus,
  disabled,
  label,
  placeholder,
  title,
  showLabel,
  onValidPassword,
}: TProps) => {
  const { t } = useTranslation();
  const capsLock = useCapsLock();

  const [password, setPassword] = useState('');
  const [seePlaintext, setSeePlaintext] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);

  // Autofocus
  useEffect(() => {
    if (autoFocus && passwordRef.current) {
      passwordRef.current.focus();
    }
  }, [autoFocus]);

  const tryPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    if (event.currentTarget.type === 'password') {
      event.preventDefault();
      alertUser(
        t('password.warning.paste', {
          label,
        })
      );
    }
  };

  const validate = (value: string) => {
    if (passwordRef.current && !passwordRef.current.validity.valid) {
      onValidPassword(null);
      return;
    }
    if (value) {
      onValidPassword(value);
    } else {
      onValidPassword(null);
    }
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.type === 'checkbox') {
      setSeePlaintext(event.target.checked);
    } else {
      const newPassword = event.target.value;
      setPassword(newPassword);
      validate(newPassword);
    }
  };

  const warning = (
    capsLock && !seePlaintext ? (
      <span className={style.capsWarning} title={t('password.warning.caps')}>
        ⇪
      </span>
    ) : null
  );

  return (
    <Input
      autoFocus
      disabled={disabled}
      type={seePlaintext ? 'text' : 'password'}
      pattern={pattern}
      title={title}
      id="password"
      label={label}
      placeholder={placeholder}
      onInput={handleFormChange}
      onPaste={tryPaste}
      ref={passwordRef}
      value={password}
      labelSection={
        <Checkbox
          id="seePlaintext"
          onChange={handleFormChange}
          checked={seePlaintext}
          label={t('password.show', {
            label: showLabel || label,
          })}
        />
      }
    >
      {warning}
    </Input>
  );
};

type TPasswordRepeatProps = TProps & {
  repeatLabel?: string;
  repeatPlaceholder: string;
};

export const PasswordRepeatInput = ({
  pattern,
  autoFocus,
  disabled,
  label,
  placeholder,
  title,
  repeatLabel,
  repeatPlaceholder,
  showLabel,
  onValidPassword,
}: TPasswordRepeatProps) => {
  const { t } = useTranslation();
  const capsLock = useCapsLock();

  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [seePlaintext, setSeePlaintext] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordRepeatRef = useRef<HTMLInputElement>(null);

  const regex = useMemo(() => (pattern ? new RegExp(pattern) : null), [pattern]);

  // Autofocus
  useEffect(() => {
    if (autoFocus && passwordRef.current) {
      passwordRef.current.focus();
    }
  }, [autoFocus]);

  const tryPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    if (event.currentTarget.type === 'password') {
      event.preventDefault();
      alertUser(
        t('password.warning.paste', {
          label,
        })
      );
    }
  };

  const validate = (pwd: string, pwdRepeat: string) => {
    if (
      passwordRef.current &&
      passwordRepeatRef.current &&
      (!passwordRef.current.validity.valid || !passwordRepeatRef.current.validity.valid)
    ) {
      onValidPassword(null);
      return;
    }
    if (pwd && pwd === pwdRepeat) {
      onValidPassword(pwd);
    } else {
      onValidPassword(null);
    }
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.type === 'checkbox') {
      setSeePlaintext(event.target.checked);
      return;
    }
    switch (event.target.id) {
    case 'passwordRepeatFirst':
      const newPassword = event.target.value;
      setPassword(newPassword);
      validate(newPassword, passwordRepeat);
      break;
    case 'passwordRepeatSecond':
      const newRepeat = event.target.value;
      setPasswordRepeat(newRepeat);
      validate(password, newRepeat);
      break;
    }
  };

  const warning =
    capsLock && !seePlaintext ? (
      <span className={style.capsWarning} title={t('password.warning.caps')}>
        ⇪
      </span>
    ) : null;

  return (
    <div>
      <Input
        autoFocus
        disabled={disabled}
        type={seePlaintext ? 'text' : 'password'}
        pattern={pattern}
        id="passwordRepeatFirst"
        label={label}
        placeholder={placeholder}
        onInput={handleFormChange}
        onPaste={tryPaste}
        ref={passwordRef}
        value={password}
      >
        {warning}
      </Input>

      {regex && (
        <MatchesPattern regex={regex} text={title} value={password} />
      )}

      <Input
        disabled={disabled}
        type={seePlaintext ? 'text' : 'password'}
        pattern={pattern}
        id="passwordRepeatSecond"
        label={repeatLabel}
        placeholder={repeatPlaceholder}
        onInput={handleFormChange}
        onPaste={tryPaste}
        ref={passwordRepeatRef}
        value={passwordRepeat}
      >
        {warning}
      </Input>

      {regex && (
        <MatchesPattern regex={regex} text={title} value={passwordRepeat} />
      )}

      <Field>
        <Checkbox
          id="seePlaintext"
          onChange={handleFormChange}
          checked={seePlaintext}
          label={t('password.show', {
            label: showLabel || label,
          })}
        />
      </Field>
    </div>
  );
};

type MatchesPatternProps = {
  regex: RegExp | undefined;
  value: string;
  text: string | undefined;
};

const MatchesPattern = ({ regex, value = '', text }: MatchesPatternProps) => {
  if (!regex || !value.length || regex.test(value)) {
    return null;
  }
  return (
    <p style={{ color: 'var(--color-error)' }}>
      {text}
    </p>
  );
};
