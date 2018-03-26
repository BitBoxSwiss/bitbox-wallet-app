import { Component } from 'preact';
import Dialog from '../../components/dialog/dialog';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';
import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import ManageBackups from '../../routes/device/manage-backups/manage-backups';

import { apiPost } from '../../utils/request';

export default class Seed extends Component {
    stateEnum = Object.freeze({
        DEFAULT: "default",
        WAITING: "waiting",
        ERROR: "error"
    })

    constructor(props) {
        super(props);
        this.state = {
            state: this.stateEnum.DEFAULT,
            walletName: "",
            error: ""
        };
    }

    validate = () => {
        return this.state.walletName != "";
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
        apiPost("device/create-wallet", { walletName: this.state.walletName }).then(data => {
            if(!data.success) {
                this.setState({ state: this.stateEnum.ERROR, error: data.errorMessage });
            }
        });
    };

    render({}, state) {
        var FormSubmissionState = props => {
            switch(props.state){
            case this.stateEnum.DEFAULT:
                break;
            case this.stateEnum.WAITING:
                return (
                    <div>Creating wallet..</div>
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
                    autoComplete="off"
                    id="walletName"
                    label="Wallet Name"
                    disabled={state.state == this.stateEnum.WAITING}
                    onInput={this.handleFormChange}
                    value={state.walletName}
                    />
                </div>
                <div>
                  <Button
                    type="submit"
                    primary={true}
                    raised={true}
                    disabled={!this.validate() || state.state == this.stateEnum.WAITING}
                    >Create Wallet</Button>
                </div>
                <FormSubmissionState {...state}/>
              </form>
              <p>-- OR --</p>
              <ManageBackups showCreate={false}/>
            </Dialog>
        );
    }
};
