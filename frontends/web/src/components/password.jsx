/**
 * Copyright 2018 Shift Devices AG
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
import { Input, Checkbox, Field } from './forms';
import { alertUser } from './alert/Alert';
import style from './password.module.css';
import { withTranslation } from 'react-i18next';

export const PasswordInput = (props) => {
  const { seePlaintext, ...rest } = props;
  return (
    <Input
      type={seePlaintext ? 'text' : 'password'}
      {...rest}
    />
  );
};

class PasswordSingleInputClass extends Component {
  state = {
    password: '',
    seePlaintext: false,
    capsLock: false
  };

  password = createRef();

  idPrefix = () => {
    return this.props.idPrefix || '';
  };

  UNSAFE_componentWillMount() {
    window.addEventListener('keydown', this.handleCheckCaps);
  }

  componentDidMount() {
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

  tryPaste = event => {
    if (event.target.type === 'password') {
      event.preventDefault();
      alertUser(this.props.t('password.warning.paste', {
        label: this.props.label
      }));
    }
  };

  clear = () => {
    this.setState({
      password: '',
      seePlaintext: false,
      capsLock: false
    });
  };

  validate = () => {
    if (this.regex && this.password.current && !this.password.current.validity.valid) {
      return this.props.onValidPassword(null);
    }
    if (this.state.password) {
      this.props.onValidPassword(this.state.password);
    } else {
      this.props.onValidPassword(null);
    }
  };

  handleFormChange = event => {
    let value = event.target.value;
    if (event.target.type === 'checkbox') {
      value = event.target.checked;
    }
    const stateKey = event.target.id.slice(this.idPrefix().length);
    this.setState({ [stateKey]: value }, this.validate);
  };

  handleCheckCaps = event => {
    const capsLock = hasCaps(event);
    if (capsLock !== null) {
      this.setState({ capsLock });
    }
  };

  render() {
    const {
      t,
      disabled,
      label,
      placeholder,
      pattern,
      title,
      showLabel,
    } = this.props;
    const {
      password,
      seePlaintext,
      capsLock,
    } = this.state;
    const warning = (capsLock && !seePlaintext) && (
      <span className={style.capsWarning}
        title={t('password.warning.caps')}>⇪</span>
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
              label: showLabel || label
            })} />
        }>
        {warning}
      </Input>
    );
  }

}

export const PasswordSingleInput = withTranslation(null, { withRef: true })(PasswordSingleInputClass);


class PasswordRepeatInputClass extends Component {
  state = {
    password: '',
    passwordRepeat: '',
    seePlaintext: false,
    capsLock: false
  };

  password = createRef();
  passwordRepeat = createRef();

  idPrefix = () => {
    return this.props.idPrefix || '';
  };

  UNSAFE_componentWillMount() {
    window.addEventListener('keydown', this.handleCheckCaps);
  }

  componentDidMount() {
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

  tryPaste = event => {
    if (event.target.type === 'password') {
      event.preventDefault();
      alertUser(this.props.t('password.warning.paste', {
        label: this.props.label
      }));
    }
  };

  validate = () => {
    if (
      this.regex && this.password.current && this.passwordRepeat.current
            && (!this.password.current.validity.valid || !this.passwordRepeat.current.validity.valid)
    ) {
      return this.props.onValidPassword(null);
    }
    if (this.state.password && this.state.password === this.state.passwordRepeat) {
      this.props.onValidPassword(this.state.password);
    } else {
      this.props.onValidPassword(null);
    }
  };

  handleFormChange = event => {
    let value = event.target.value;
    if (event.target.type === 'checkbox') {
      value = event.target.checked;
    }
    const stateKey = event.target.id.slice(this.idPrefix().length);
    this.setState({ [stateKey]: value }, this.validate);
  };

  handleCheckCaps = event => {
    const capsLock = hasCaps(event);
        if (capsLock != null) { // eslint-disable-line
      this.setState({ capsLock });
    }
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
    const {
      password,
      passwordRepeat,
      seePlaintext,
      capsLock,
    } = this.state;
    const warning = (capsLock && !seePlaintext) && (
      <span className={style.capsWarning}
        title={t('password.warning.caps')}>⇪</span>
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
          value={password}>
          {warning}
        </Input>
        <MatchesPattern
          regex={this.regex}
          text={title}
          value={password} />
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
          value={passwordRepeat}>
          {warning}
        </Input>
        <MatchesPattern
          regex={this.regex}
          text={title}
          value={passwordRepeat} />
        <Field>
          <Checkbox
            id={this.idPrefix() + 'seePlaintext'}
            onChange={this.handleFormChange}
            checked={seePlaintext}
            label={t('password.show', {
              label: showLabel || label
            })} />
        </Field>
      </div>
    );
  }
}

export const PasswordRepeatInput = withTranslation(null, { withRef: true })(PasswordRepeatInputClass);

const MatchesPattern = ({ regex, value = '', text }) => {
  if (!regex || !value.length || regex.test(value)) {
    return null;
  }

  return (
    <p style={{ color: 'var(--color-error)' }}>{text}</p>
  );
};

const excludeKeys = /^(Shift|Alt|Backspace|CapsLock|Tab)$/i;

const hasCaps = ({ key }) => {
  // will return null, when we cannot clearly detect if capsLock is active or not
  if (key.length > 1 || key.toUpperCase() === key.toLowerCase() || excludeKeys.test(key)) {
    return null;
  }
  // ideally we return event.getModifierState('CapsLock')) but this currently does always return false in Qt
  // @ts-ignore (event can be undefined and shiftKey exists only on MouseEvent but not Event)
  // eslint-disable-next-line no-restricted-globals
  return key.toUpperCase() === key && key.toLowerCase() !== key && !event.shiftKey;
};
