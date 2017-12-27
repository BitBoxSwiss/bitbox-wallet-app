import { Component } from 'preact';
import Dialog from '../dialog';
import PasswordInput from '../password';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Checkbox from 'preact-material-components/Checkbox';
import Formfield from 'preact-material-components/Formfield';
import 'preact-material-components/Checkbox/style.css';

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
            state: this.stateEnum.DEFAULT,
            password: "",
            passwordRepeat: "",
            seePlaintext: false,
            error: ""
        };
    }

    validate = () => {
        return this.state.password && this.state.password === this.state.passwordRepeat;
    }

    handleFormChange = event => {
        let value = event.target.value;
        if(event.target.type == "checkbox") {
            value = event.target.checked;
        }
        this.setState({ [event.target.id]: value });
    };

    handleSubmit = event => {
        event.preventDefault();
        if(!this.validate()) {
            return;
        }
        this.setState({
            state: this.stateEnum.DEFAULT,
            error: ""
        });
        this.setState({ state: this.stateEnum.WAITING });
        apiPost("device/set-password", { password: this.state.password }).then(data => {
            if(data.success) {
                this.setState({ password: "", passwordRepeat: ""});
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
                <div>
                  <PasswordInput
                    autoFocus
                    id="password"
                    seePlaintext={state.seePlaintext}
                    label="Password"
                    disabled={state.state == this.stateEnum.WAITING}
                    onInput={this.handleFormChange}
                    value={state.password}
                    />
                </div>
                <div>
                  <PasswordInput
                    id="passwordRepeat"
                    seePlaintext={state.seePlaintext}
                    label="Repeat Password"
                    disabled={state.state == this.stateEnum.WAITING}
                    onInput={this.handleFormChange}
                    value={state.passwordRepeat}
                    />
                </div>
                <Formfield>
                  <Checkbox
                    id="seePlaintext"
                    onChange={this.handleFormChange}
                    checked={state.seePlaintext}
                    />
                  <label for="seePlaintext">See Plaintext</label>
                </Formfield>
                <div>
                  <Button
                    type="submit"
                    primary={true}
                    raised={true}
                    disabled={!this.validate() || state.state == this.stateEnum.WAITING}
                    >Set Password</Button>
                </div>
                <FormSubmissionState {...state}/>
              </form>
            </Dialog>
        );
    }
};
