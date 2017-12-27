import { Component } from 'preact';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

export default class PasswordInput extends Component {
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
              onPaste={this.tryPaste}
              {...rest}
              />
        );
    }
}
