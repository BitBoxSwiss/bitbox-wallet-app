// SPDX-License-Identifier: Apache-2.0

import { forwardRef, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, type TInputProps } from './input';
import eyeOpenLight from './assets/eye-open-light.svg';
import eyeOpenDark from './assets/eye-open-dark.svg';
import eyeClosedLight from './assets/eye-closed-light.svg';
import eyeClosedDark from './assets/eye-closed-dark.svg';
import styles from './password-input.module.css';

type TProps = Omit<TInputProps, 'type'> & {
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
};

export const PasswordInput = forwardRef<HTMLInputElement, TProps>(({
  visible: controlledVisible,
  onVisibilityChange,
  id,
  label,
  onKeyDown,
  classNameInputField = '',
  children,
  ...props
}, ref) => {
  const { t } = useTranslation();
  const inputID = useId();
  const [isVisible, setIsVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const visible = controlledVisible ?? isVisible;

  return (
    <Input
      {...props}
      id={id ?? inputID}
      label={label}
      ref={ref}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      onKeyDown={event => {
        const { key, shiftKey } = event;
        // Qt does not reliably report getModifierState('CapsLock').
        if (key.length === 1 && key.toUpperCase() !== key.toLowerCase()) {
          setCapsLock(key.toUpperCase() === key && !shiftKey);
        }
        onKeyDown?.(event);
      }}
      classNameInputField={`${styles.inputField || ''} ${classNameInputField}`}>
      {capsLock && !visible && (
        <span className={styles.capsWarning} title={t('password.warning.caps')}>⇪</span>
      )}
      {children}
      <button
        type="button"
        className={styles.visibilityButton}
        aria-label={visible ? t('password.hidePassword') : t('password.showPassword')}
        onClick={() => {
          setIsVisible(!visible);
          onVisibilityChange?.(!visible);
        }}>
        <img
          src={visible ? eyeClosedLight : eyeOpenLight}
          className="show-in-lightmode"
          alt=""
          draggable={false} />
        <img
          src={visible ? eyeClosedDark : eyeOpenDark}
          className="show-in-darkmode"
          alt=""
          draggable={false} />
      </button>
    </Input>
  );
});
