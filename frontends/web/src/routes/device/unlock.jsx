import { Component } from 'preact';
import Dialog from '../../components/dialog/dialog';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import LanguageSwitcher from '../settings/components/language-switch';

import { translate } from 'react-i18next';

import { apiPost } from '../../utils/request';

@translate()
export default class Login extends Component {
    stateEnum = Object.freeze({
        DEFAULT: "default",
        WAITING: "waiting",
        ERROR: "error"
    })

    constructor(props) {
        super(props);
        this.state = {
            state: this.stateEnum.DEFAULT,
            errorMessage: "",
            errorCode: null,
            remainingAttempts: null,
            needsLongTouch: false,
            password: ""
        };
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    validate = () => {
        return this.state.password != "";
    }

    handleSubmit = event => {
        event.preventDefault();
        if(!this.validate()) {
            return;
        }
        this.setState({
            state: this.stateEnum.WAITING
        });
        apiPost("device/login", { password: this.state.password }).then(data => {
            if(!data.success) {
                if(data.code) {
                    this.setState({ errorCode: data.code });
                }
                if(data.remainingAttempts) {
                    this.setState({ remainingAttempts: data.remainingAttempts });
                }
                if(data.needsLongTouch) {
                    this.setState({ needsLongTouch: data.needsLongTouch });
                }
                this.setState({ state: this.stateEnum.ERROR, errorMessage: data.errorMessage });
            }
        });
        this.setState({ password: ""});
    };

    render({t}, state) {
        var FormSubmissionState = props => {
            switch(props.state) {
            case this.stateEnum.DEFAULT:
                break;
            case this.stateEnum.WAITING:
                return (
                    <div>{t("dbb.unlocking")}</div>
                );
            case this.stateEnum.ERROR:
                return (
                    <div>
                      {t(`dbb.error.${props.errorCode}`, {
                          defaultValue: props.errorMessage,
                          remainingAttempts: props.remainingAttempts,
                          context: props.needsLongTouch ? "touch" : "normal"
                      })}
                    </div>
                );
            }
            return null;
        };

        return (
            <Dialog>
              <LanguageSwitcher/>
              <form onsubmit={this.handleSubmit}>
                <div>
                  <Textfield
                    autoFocus
                    autoComplete="off"
                    id="password"
                    type="password"
                    label={t("Password")}
                    disabled={state.state == this.stateEnum.WAITING}
                    helptext={t("Please enter your password to log in")}
                    helptextPersistent={true}
                    onInput={this.handleFormChange}
                    value={state.password}
                    />
                </div>
                <div>
                  <Button
                    type="submit"
                    primary={true}
                    raised={true}
                    disabled={!this.validate() || state.state == this.stateEnum.WAITING}
                    >{t("Login")}</Button>
                </div>
                <FormSubmissionState {...state}/>
              </form>
            </Dialog>
        );
    }
};
