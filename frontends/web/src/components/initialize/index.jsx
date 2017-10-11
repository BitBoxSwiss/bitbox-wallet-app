import { Component } from 'preact';
import Dialog from '../dialog';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';
import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

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
            error: ""
        };
    }

    validate = () => {
        return this.state.password && this.state.password === this.state.passwordRepeat;
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
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
        apiPost("set-password", { password: this.state.password }).then(data => {
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
                  <Textfield
                    autoFocus
                    id="password"
                    type="password"
                    label="Password"
                    disabled={state.state == this.stateEnum.WAITING}
                    onInput={this.handleFormChange}
                    value={state.password}
                    />
                </div>
                <div>
                  <Textfield
                    id="passwordRepeat"
                    type="password"
                    label="Repeat Password"
                    disabled={state.state == this.stateEnum.WAITING}
                    onInput={this.handleFormChange}
                    value={state.passwordRepeat}
                    />
                </div>
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
