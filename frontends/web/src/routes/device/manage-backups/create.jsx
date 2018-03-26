import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import { apiPost } from '../../../utils/request';

export default class Create extends Component {
    constructor(props) {
        super(props);
        this.state = {
            waiting: false,
            backupName: ""
        };
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    validate = () => {
        return !this.waiting && this.state.backupName != "";
    }

    create = (event) => {
        event.preventDefault();
        if(!this.validate()) {
            return;
        }
        this.setState({ waiting: true });
        apiPost("device/backups/create", { backupName: this.state.backupName }).then(() => {
            this.props.onCreate();
        }).catch(() => {}).then(() => {
            this.setState({
                waiting: false,
                backupName: ""
            });
            this.confirmDialog.MDComponent.close();
        });
    }

    render({}, { waiting, backupName }) {
        return (
            <span>
              <Button
                primary={true}
                raised={true}
                onclick={() => { this.confirmDialog.MDComponent.show(); }}
                >Create</Button>
              <Dialog
                ref={confirmDialog=>{this.confirmDialog=confirmDialog;}}
                onAccept={this.erase}
                >
                <Dialog.Header>Create Backup</Dialog.Header>
                <form onSubmit={this.create}>
                  <Dialog.Body>
                    <Textfield
                      autoFocus
                      ref={pwf=>{this.pwf=pwf;}}
                      id="backupName"
                      label="Backup Name"
                      helptext="Please name the backup."
                      helptextPersistent={true}
                      onInput={this.handleFormChange}
                      value={backupName}
                      />
                  </Dialog.Body>
                  <Dialog.Footer>
                    <Dialog.FooterButton
                      type="button"
                      cancel={true}>Abort</Dialog.FooterButton>
                    <Dialog.FooterButton
                      type="submit"
                      disabled={waiting || !this.validate()}>Create</Dialog.FooterButton>
                  </Dialog.Footer>
                </form>
              </Dialog>
            </span>
        );
    }
}
