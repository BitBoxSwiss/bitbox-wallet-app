import { Component } from 'preact';
import Dialog from '../dialog';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import { apiPost } from '../../util';

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
            error: "",
            password: ""
        };
    }

    componentDidMount() {
        console.log(this.password);
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
        apiPost("login", { password: this.state.password }).then(data => {
            if(!data.success) {
                this.setState({ state: this.stateEnum.ERROR, error: data.errorMessage });
            }
        });
        this.setState({ password: ""});
    };

    render({}, state) {
        var FormSubmissionState = props => {
            switch(props.state) {
            case this.stateEnum.DEFAULT:
                break;
            case this.stateEnum.WAITING:
                return (
                    <div>Unlocking...</div>
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
              <form onsubmit={this.handleSubmit}>
                <div>
                  <Textfield
                    autoFocus
                    id="password"
                    type="password"
                    label="Password"
                    disabled={state.state == this.stateEnum.WAITING}
                    helptext="Please enter your password to log in"
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
                    >Login</Button>
                </div>
                <FormSubmissionState {...state}/>
              </form>
            </Dialog>
        );
    }
};
