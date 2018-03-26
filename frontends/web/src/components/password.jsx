import { Component } from 'preact';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import Checkbox from 'preact-material-components/Checkbox';
import Formfield from 'preact-material-components/Formfield';
import 'preact-material-components/Checkbox/style.css';

export class PasswordInput extends Component {
    constructor(props) {
        super(props);
    }

    tryPaste = event => {
        if(event.target.type == "password") {
            event.preventDefault();
            alert("TODO nice message: to paste text, enable \"see plaintext\"");
        }
    }

    render(props) {
        const { seePlaintext, ...rest} = props;
        return (
            <Textfield
              type={seePlaintext ? "text" : "password"}
              autoComplete="off"
              onPaste={this.tryPaste}
              {...rest}
              />
        );
    }
}

export class PasswordRepeatInput extends Component {
    constructor(props) {
        super(props);
        this.clear();
    }

    clear = () => {
        this.state = {
            password: "",
            passwordRepeat: "",
            seePlaintext: false
        };
    }

    validate = () => {
        if(this.state.password && this.state.password === this.state.passwordRepeat) {
            this.props.onValidPassword(this.state.password);
        } else {
            this.props.onValidPassword(null);
        }
    }

    handleFormChange = event => {
        let value = event.target.value;
        if(event.target.type == "checkbox") {
            value = event.target.checked;
        }
        this.setState({ [event.target.id]: value });
        this.validate();
    };


    render({ disabled, helptext }, { password, passwordRepeat, seePlaintext }) {
        return (
            <div>
              <div>
                <PasswordInput
                  autoFocus
                  id="password"
                  seePlaintext={seePlaintext}
                  label="Password"
                  helptext={helptext}
                  helptextPersistent={true}
                  disabled={disabled}
                  onInput={this.handleFormChange}
                  value={password}
                  />
              </div>
              <div>
                <PasswordInput
                  id="passwordRepeat"
                  seePlaintext={seePlaintext}
                  label="Repeat Password"
                  disabled={disabled}
                  onInput={this.handleFormChange}
                  value={passwordRepeat}
                  />
              </div>
              <Formfield>
                <Checkbox
                  id="seePlaintext"
                  onChange={this.handleFormChange}
                  checked={seePlaintext}
                  />
                <label for="seePlaintext">See Plaintext</label>
              </Formfield>
            </div>
        );
    }
}
