import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import Dialog from 'preact-material-components/Dialog';
import 'preact-material-components/Dialog/style.css';

import Select from 'preact-material-components/Select';
import 'preact-material-components/List/style.css';
import 'preact-material-components/Menu/style.css';
import 'preact-material-components/Select/style.css';

import Textfield from 'preact-material-components/Textfield';
import 'preact-material-components/Textfield/style.css';

import WaitDialog from '../../components/wait-dialog';
import PasswordInput from '../password';

import { apiGet, apiPost } from '../../util';

import style from './style';

export default class ManageBackups extends Component {
    constructor(props) {
        super(props);
        this.state = {
            backupList: [],
            selectedBackup: null,
            sdCardInserted: false
        };
    }

    componentDidMount() {
        this.refresh();
    }

    refresh = () => {
        apiGet("device/backups/list").then(({ sdCardInserted, backupList }) => {
            this.setState({
                selectedBackup: null,
                sdCardInserted: sdCardInserted,
                backupList: backupList
            });
        });
    }

    handleBackuplistChange = event => {
        this.setState({ selectedBackup: this.state.backupList[event.target.selectedIndex] });
    }

    render({ showCreate }, { backupList, selectedBackup, sdCardInserted }) {
        if(!sdCardInserted) {
            return (
                <div>
                  <p>Please insert SD card to manage backups.</p>
                  <Button
                    primary={true}
                    raised={true}
                    onclick={() => { this.refresh(); }}
                    >I have inserted the SD card</Button>
                </div>
            );
        }
        const selectClasses = ["mdc-multi-select", "mdc-list", style.backupList].join(' ');
        const option = filename => <option className="mdc-list-item">{ filename }</option>;
        return (
            <div>
              <h1>Manage Backups</h1>
              <div>
                <select
                  id="backupList"
                  size="6"
                  className={selectClasses}
                  onChange={this.handleBackuplistChange}
                  >{ backupList.map(option) }
                </select>
                <RestoreButton selectedBackup={selectedBackup}/>
                &nbsp;
                <EraseButton
                  selectedBackup={selectedBackup}
                  onErase={this.refresh}
                  />
                {showCreate && <span>&nbsp;<CreateButton onCreate={this.refresh}/></span>}
              </div>
            </div>
        );
    }
}

class EraseButton extends Component {
    erase = () => {
        const filename = this.props.selectedBackup;
        if(!filename) {
            return;
        }
        apiPost("device/backups/erase", { filename: filename }).then(() => {
            this.props.onErase();
        });
    }

    render({ selectedBackup }) {
        return (
            <span>
              <Button
                primary={true}
                raised={true}
                disabled={selectedBackup === null}
                onclick={() => { this.confirmDialog.MDComponent.show(); }}
                >Erase</Button>
              <Dialog
                ref={confirmDialog=>{this.confirmDialog=confirmDialog;}}
                onAccept={this.erase}
                >
                <Dialog.Header>Erase {selectedBackup}</Dialog.Header>
                <Dialog.Body>
                  Do you really want to erase {selectedBackup}?
                </Dialog.Body>
                <Dialog.Footer>
                  <Dialog.FooterButton cancel={true}>Abort</Dialog.FooterButton>
                  <Dialog.FooterButton accept={true}>Erase</Dialog.FooterButton>
                </Dialog.Footer>
              </Dialog>
            </span>
        );
    }
}

class CreateButton extends Component {
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

class RestoreButton extends Component {
    constructor(props) {
        super(props);
        this.state = {
            password: ""
        };
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    validate = () => {
        return this.props.selectedBackup && this.state.password;
    }

    restore = (event) => {
        event.preventDefault();
        if(!this.validate()) {
            return;
        }
        this.confirmDialog.MDComponent.close();
        this.waitDialog.MDComponent.show();
        apiPost("device/backups/restore", {
            password: this.state.password,
            filename: this.props.selectedBackup
        }).catch(() => {}).then(() => {
            this.setState({ password: "" });
            this.waitDialog.MDComponent.close();
        });
    }

    render({ selectedBackup }, { password }) {
        return (
            <span>
              <Button
                primary={true}
                raised={true}
                disabled={selectedBackup === null}
                onclick={() => { this.confirmDialog.MDComponent.show(); }}
                >Restore</Button>
              <Dialog
                ref={confirmDialog=>{this.confirmDialog=confirmDialog;}}
                onAccept={this.restore}
                >
                <Dialog.Header>Restore {selectedBackup}</Dialog.Header>
                <form ref={form=>{this.form=form;}} onSubmit={this.restore}>
                  <Dialog.Body>
                    <PasswordInput
                      autoFocus
                      id="password"
                      type="password"
                      label="Password"
                      helptext="Please enter the same password as when the backup was created."
                      helptextPersistent={true}
                      onInput={this.handleFormChange}
                      value={password}
                      />
                  </Dialog.Body>
                  <Dialog.Footer>
                    <Dialog.FooterButton
                      type="button"
                      cancel={true}>Abort</Dialog.FooterButton>
                    <Dialog.FooterButton
                      type="submit"
                      disabled={!this.validate()}
                      >Restore</Dialog.FooterButton>
                  </Dialog.Footer>
                </form>
              </Dialog>
              <WaitDialog ref={waitDialog=>{this.waitDialog=waitDialog;}}>
                <WaitDialog.Header>Restore Backup</WaitDialog.Header>
                <WaitDialog.Body>
                  <p>Short touch = abort</p>
                  <p>Long touch = confirm</p>
                </WaitDialog.Body>
              </WaitDialog>
            </span>
        );
    }
}
