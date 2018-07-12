import { Component } from 'preact';
import i18n from '../i18n/i18n';
import { Input, Checkbox, Field } from './forms';
import style from './password.css';

export function PasswordInput (props) {
    const { seePlaintext, ...rest } = props;
    return (
        <Input
            type={seePlaintext ? 'text' : 'password'}
            {...rest}
        />
    );
}

export class PasswordRepeatInput extends Component {
    state = {
        password: '',
        passwordRepeat: '',
        seePlaintext: false,
        capsLock: false
    }

    idPrefix = () => {
        return this.props.idPrefix || '';
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleCheckCaps);
        document.addEventListener('keyup', this.handleCheckCaps);
    }

    componentDidMount() {
        if (this.props.pattern) {
            this.regex = new RegExp(this.props.pattern);
        }
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleCheckCaps);
        document.removeEventListener('keyup', this.handleCheckCaps);
    }

    tryPaste = event => {
        if (event.target.type === 'password') {
            event.preventDefault();
            alert(i18n.t('password.warning.paste', { // eslint-disable-line no-alert
                label: this.props.label
            }));
        }
    }

    clear = () => {
        this.setState({
            password: '',
            passwordRepeat: '',
            seePlaintext: false,
            capsLock: false
        });
    }

    validate = () => {
        if (this.regex && (!this.password.validity.valid || !this.passwordRepeat.validity.valid)) {
            return this.props.onValidPassword(null);
        }
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
        const stateKey = event.target.id.slice(this.idPrefix().length);
        this.setState({ [stateKey]: value });
        this.validate();
    }

    handleCheckCaps = event => {
        const capsLock = event.getModifierState && event.getModifierState('CapsLock');
        this.setState({ capsLock });
    }

    render({
        t,
        disabled,
        label,
        placeholder,
        pattern = false,
        title,
        repeatLabel,
        repeatPlaceholder,
        showLabel,
    }, {
        password,
        passwordRepeat,
        seePlaintext,
        capsLock,
    }) {
        const warning = (capsLock && !seePlaintext) && (
            <span className={style.capsWarning}
                title={i18n.t('password.warning.caps')}>⇪</span>
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
                    onKeyUp={this.handleCheckCaps}
                    onKeyDown={this.handleCheckCaps}
                    getRef={ref => this.password = ref}
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
                    onKeyUp={this.handleCheckCaps}
                    onKeyDown={this.handleCheckCaps}
                    getRef={ref => this.passwordRepeat = ref}
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
                        label={i18n.t('password.show', {
                            label: showLabel || label
                        })} />
                </Field>
            </div>
        );
    }
}

function MatchesPattern({ regex, value = '', text }) {
    if (!regex || !value.length || regex.test(value)) {
        return null;
    }

    return (
        <p style="color: var(--color-error);">{text}</p>
    );
}
