import { Component } from 'preact';
import Dialog from '../../components/dialog/dialog';
import { PasswordRepeatInput } from '../../components/password';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import LanguageSwitcher from '../settings/components/language-switch';

import { translate } from 'react-i18next';

import { apiPost } from '../../utils/request';

@translate()
export default class Initialize extends Component {
    stateEnum = Object.freeze({
        DEFAULT: "default",
        WAITING: "waiting",
        ERROR: "error"
    })

    constructor(props) {
        super(props);
        this.state = {
            password: null,
            state: this.stateEnum.DEFAULT,
            errorCode: null,
            errorMessage: ""
        };
    }

    handleSubmit = event => {
        event.preventDefault();
        if(!this.state.password) {
            return;
        }
        this.setState({
            state: this.stateEnum.DEFAULT,
            error: ""
        });
        this.setState({ state: this.stateEnum.WAITING });
        apiPost("device/set-password", { password: this.state.password }).then(data => {
            if(data.success) {
                if(this.passwordInput) {
                    this.passwordInput.clear();
                }
            } else {
                if(data.code) {
                    this.setState({ errorCode: data.code });
                }
                this.setState({ state: this.stateEnum.ERROR, errorMessage: data.errorMessage });
            }
        });
    };

    render({t}, state) {
        var FormSubmissionState = props => {
            switch(props.state) {
            case this.stateEnum.DEFAULT:
                break;
            case this.stateEnum.WAITING:
                return (
                    <div>Setting password...</div>
                );
            case this.stateEnum.ERROR:
                return (
                    <div>
                      {t(`dbb.error.${props.errorCode}`, {
                          defaultValue: props.errorMessage
                      })}
                    </div>
                );
            }
            return null;
        };

        return (
            <Dialog>
              <LanguageSwitcher/>
              <p>Please set a password to interact with your device</p>
              <form onsubmit={this.handleSubmit}>
                <PasswordRepeatInput
                  ref={ref => { this.passwordInput = ref; }}
                  disabled={state.state == this.stateEnum.WAITING}
                  onValidPassword={password => this.setState({ password: password })}
                  />
                <div>
                  <Button
                    type="submit"
                    primary={true}
                    raised={true}
                    disabled={!state.password || state.state == this.stateEnum.WAITING}
                    >Set Password</Button>
                </div>
                <FormSubmissionState {...state}/>
              </form>
            </Dialog>
        );
    }
};
