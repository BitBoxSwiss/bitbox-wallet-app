/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2024 Shift Crypto AG
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

import { Component, createRef } from 'react';
import { TranslateProps, translate } from '@/decorators/translate';
import { Input, Checkbox, Field } from './forms';
import { alertUser } from './alert/Alert';
import style from './password.module.css';

const excludeKeys = /^(Shift|Alt|Backspace|CapsLock|Tab)$/i;

const hasCaps = (event: KeyboardEvent) => {
  const key = event.key;
  // will return null, when we cannot clearly detect if capsLock is active or not
  if (
    key.length > 1 ||
    key.toUpperCase() === key.toLowerCase() ||
    excludeKeys.test(key)
  ) {
    return null;
  }
  // ideally we return event.getModifierState('CapsLock')) but this currently does always return false in Qt
  return (
    key.toUpperCase() === key && key.toLowerCase() !== key && !event.shiftKey
  );
};

type TPropsPasswordInput = {
  seePlaintext?: boolean;
  id?: string;
  idPrefix?: string;
  label: string;
  placeholder?: string;
  onInput?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
};
export const PasswordInput = ({
  seePlaintext,
  ...rest
}: TPropsPasswordInput) => {
  return <Input type={seePlaintext ? 'text' : 'password'} {...rest} />;
};

type TProps = {
  idPrefix?: string;
  pattern?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  title?: string;
  showLabel?: string;
  onValidPassword: (password: string | null) => void;
};

type TPasswordSingleInputProps = TProps & TranslateProps;

type TState = {
  password: string;
  seePlaintext: boolean;
  capsLock: boolean;
};

class PasswordSingleInputClass extends Component<
  TPasswordSingleInputProps,
  TState
> {
  private regex?: RegExp;

  state = {
    password: '',
    seePlaintext: false,
    capsLock: false,
  };

  password = createRef<HTMLInputElement>();

  idPrefix = () => {
    return this.props.idPrefix || '';
  };

  handleCheckCaps = (event: KeyboardEvent) => {
    const capsLock = hasCaps(event);

    if (capsLock !== null) {
      this.setState({ capsLock });
    }
  };

  componentDidMount() {
    window.addEventListener('keydown', this.handleCheckCaps);
    if (this.props.pattern) {
      this.regex = new RegExp(this.props.pattern);
    }
    if (this.props.autoFocus && this.password?.current) {
      this.password.current.focus();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleCheckCaps);
  }

  tryPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const target = event.currentTarget;
    if (target.type === 'password') {
      event.preventDefault();
      alertUser(
        this.props.t('password.warning.paste', {
          label: this.props.label,
        }),
      );
    }
  };

  clear = () => {
    this.setState({
      password: '',
      seePlaintext: false,
      capsLock: false,
    });
  };

  validate = () => {
    if (
      this.regex &&
      this.password.current &&
      !this.password.current.validity.valid
    ) {
      return this.props.onValidPassword(null);
    }
    if (this.state.password) {
      this.props.onValidPassword(this.state.password);
    } else {
      this.props.onValidPassword(null);
    }
  };

  handleFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value: string | boolean = event.target.value;
    if (event.target.type === 'checkbox') {
      value = event.target.checked;
    }
    const stateKey = event.target.id.slice(
      this.idPrefix().length,
    ) as keyof TState;
    this.setState(
      { [stateKey]: value } as Pick<TState, keyof TState>,
      this.validate,
    );
  };

  render() {
    const { t, disabled, label, placeholder, pattern, title, showLabel } =
      this.props;
    const { password, seePlaintext, capsLock } = this.state;
    const warning = capsLock && !seePlaintext && (
      <span className={style.capsWarning} title={t('password.warning.caps')}>
        ⇪
      </span>
    );
    return (
      <Input
        autoFocus
        disabled={disabled}
        type={seePlaintext ? 'text' : 'password'}
        pattern={pattern}
        title={title}
        id={this.idPrefix() + 'password'}
        label={label}
        placeholder={placeholder}
        onInput={this.handleFormChange}
        onPaste={this.tryPaste}
        ref={this.password}
        value={password}
        labelSection={
          <Checkbox
            id={this.idPrefix() + 'seePlaintext'}
            onChange={this.handleFormChange}
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
  }
}

const HOC = translate(undefined, { withRef: true })(PasswordSingleInputClass);
export { HOC as PasswordSingleInput };

type TPasswordRepeatProps = TPasswordSingleInputProps & {
  repeatLabel?: string;
  repeatPlaceholder: string;
};

class PasswordRepeatInputClass extends Component<TPasswordRepeatProps, TState> {
  private regex?: RegExp;

  state = {
    password: '',
    passwordRepeat: '',
    seePlaintext: false,
    capsLock: false,
  };

  password = createRef<HTMLInputElement>();
  passwordRepeat = createRef<HTMLInputElement>();

  idPrefix = () => {
    return this.props.idPrefix || '';
  };

  handleCheckCaps = (event: KeyboardEvent) => {
    const capsLock = hasCaps(event);

    if (capsLock !== null) {
      this.setState({ capsLock });
    }
  };

  componentDidMount() {
    window.addEventListener('keydown', this.handleCheckCaps);
    if (this.props.pattern) {
      this.regex = new RegExp(this.props.pattern);
    }
    if (this.props.autoFocus && this.password?.current) {
      this.password.current.focus();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleCheckCaps);
  }

  tryPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const target = event.currentTarget;
    if (target.type === 'password') {
      event.preventDefault();
      alertUser(
        this.props.t('password.warning.paste', {
          label: this.props.label,
        }),
      );
    }
  };

  validate = () => {
    if (
      this.regex &&
      this.password.current &&
      this.passwordRepeat.current &&
      (!this.password.current.validity.valid ||
        !this.passwordRepeat.current.validity.valid)
    ) {
      return this.props.onValidPassword(null);
    }
    if (
      this.state.password &&
      this.state.password === this.state.passwordRepeat
    ) {
      this.props.onValidPassword(this.state.password);
    } else {
      this.props.onValidPassword(null);
    }
  };

  handleFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value: string | boolean = event.target.value;
    if (event.target.type === 'checkbox') {
      value = event.target.checked;
    }
    const stateKey = event.target.id.slice(this.idPrefix().length);
    this.setState(
      { [stateKey]: value } as Pick<TState, keyof TState>,
      this.validate,
    );
  };

  render() {
    const {
      t,
      disabled,
      label,
      placeholder,
      pattern,
      title,
      repeatLabel,
      repeatPlaceholder,
      showLabel,
    } = this.props;
    const { password, passwordRepeat, seePlaintext, capsLock } = this.state;
    const warning = capsLock && !seePlaintext && (
      <span className={style.capsWarning} title={t('password.warning.caps')}>
        ⇪
      </span>
    );
    return (
      <div>
        <Input
          autoFocus
          disabled={disabled}
          type={seePlaintext ? 'text' : 'password'}
          pattern={pattern}
          title={title}
          id={this.idPrefix() + 'password'}
          label={label}
          placeholder={placeholder}
          onInput={this.handleFormChange}
          onPaste={this.tryPaste}
          ref={this.password}
          value={password}
        >
          {warning}
        </Input>
        <MatchesPattern regex={this.regex} text={title} value={password} />
        <Input
          disabled={disabled}
          type={seePlaintext ? 'text' : 'password'}
          pattern={pattern}
          title={title}
          id={this.idPrefix() + 'passwordRepeat'}
          label={repeatLabel}
          placeholder={repeatPlaceholder}
          onInput={this.handleFormChange}
          onPaste={this.tryPaste}
          ref={this.password}
          value={passwordRepeat}
        >
          {warning}
        </Input>
        <MatchesPattern
          regex={this.regex}
          text={title}
          value={passwordRepeat}
        />
        <Field>
          <Checkbox
            id={this.idPrefix() + 'seePlaintext'}
            onChange={this.handleFormChange}
            checked={seePlaintext}
            label={t('password.show', {
              label: showLabel || label,
            })}
          />
        </Field>
      </div>
    );
  }
}

const HOCRepeat = translate(undefined, { withRef: true })(
  PasswordRepeatInputClass,
);
export { HOCRepeat as PasswordRepeatInput };

type MatchesPatternProps = {
  regex: RegExp | undefined;
  value: string;
  text: string | undefined;
};
const MatchesPattern = ({ regex, value = '', text }: MatchesPatternProps) => {
  if (!regex || !value.length || regex.test(value)) {
    return null;
  }

  return <p style={{ color: 'var(--color-error)' }}>{text}</p>;
};
