import { Component } from 'preact';

import { Input, Checkbox, Field } from './forms';

export function PasswordInput (props) {
    const { seePlaintext, ...rest } = props;
    return (
        <Input
            type={seePlaintext ? 'text' : 'password'}
            autoComplete="off"
            {...rest}
        />
    );
}

export class PasswordRepeatInput extends Component {
    constructor(props) {
        super(props);
        this.state = this.getInitialState();
    }

    tryPaste = event => {
        if (event.target.type === 'password') {
            event.preventDefault();
            alert('to paste text, enable \"see plaintext\"');
        }
    }

    clear = () => {
        this.setState(this.getInitialState());
    }

    getInitialState() {
        return {
            password: '',
            passwordRepeat: '',
            seePlaintext: false,
            capsLock: false
        };
    }

    validate = () => {
        if (this.state.password && this.state.password === this.state.passwordRepeat) {
            this.props.onValidPassword(this.state.password);
        } else {
            this.props.onValidPassword(null);
        }
    }

    handleFormChange = event => {
        let value = event.target.value;
        if (event.target.type === 'checkbox') {
            value = event.target.checked;
        }
        this.setState({ [event.target.id]: value });
        this.validate();
    }

    handleCheckCaps = event => {
        const capsLock = event.getModifierState && event.getModifierState('CapsLock');
        this.setState({ capsLock });
    }

    render({ disabled, helptext, label }, { password, passwordRepeat, seePlaintext, capsLock }) {
        const warning = (capsLock && !seePlaintext) && <p>WARNING: caps lock (⇪) are enabled</p>;
        return (
            <div>
                <PasswordInput
                    autoFocus
                    id="password"
                    seePlaintext={seePlaintext}
                    label={label}
                    placeholder={helptext}
                    disabled={disabled}
                    onInput={this.handleFormChange}
                    onPaste={this.tryPaste}
                    onKeyUp={this.handleCheckCaps}
                    onKeyDown={this.handleCheckCaps}
                    value={password}
                />
                <PasswordInput
                    id="passwordRepeat"
                    seePlaintext={seePlaintext}
                    label={`Repeat ${label}`}
                    disabled={disabled}
                    onInput={this.handleFormChange}
                    onPaste={this.tryPaste}
                    onKeyUp={this.handleCheckCaps}
                    onKeyDown={this.handleCheckCaps}
                    value={passwordRepeat}
                />
                {warning}
                <Field>
                    <Checkbox
                        id="seePlaintext"
                        onChange={this.handleFormChange}
                        checked={seePlaintext}
                        label="See Plaintext"
                    />
                </Field>
            </div>
        );
    }
}
