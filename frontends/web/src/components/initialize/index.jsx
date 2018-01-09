import { Component } from 'preact';
import Dialog from '../dialog';
import { PasswordRepeatInput } from '../password';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import { apiPost } from '../../util';

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
            error: ""
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
                this.setState({ state: this.stateEnum.ERROR, error: data.errorMessage });
            }
        });
    };

    render({}, state) {
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
                    <div>{props.error}</div>
                );
            }
            return null;
        };

        return (
            <Dialog>
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
