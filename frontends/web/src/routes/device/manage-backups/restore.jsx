import { Component } from 'preact';
import Button from 'preact-material-components/Button';
import Dialog from 'preact-material-components/Dialog';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import { PasswordRepeatInput } from '../../../components/password';
import { apiPost } from '../../../utils/request';
import 'preact-material-components/Button/style.css';
import 'preact-material-components/Dialog/style.css';

export default class Restore extends Component {
  state = {
    password: null,
    isConfirming: false,
  }

  handleFormChange = event => {
    this.setState({ [event.target.id]: event.target.value });
  }

  validate = () => {
    return this.props.selectedBackup && this.state.password;
  }

  restore = (event) => {
    event.preventDefault();
    if (!this.validate()) {
      return;
    }
    this.confirmDialog.MDComponent.close();
    this.setState({ isConfirming: true });
    apiPost('devices/' + this.props.deviceID + '/backups/restore', {
      password: this.state.password,
      filename: this.props.selectedBackup
    }).catch(() => {
    }).then(data => {
      if (!data.didRestore) {
        this.props.displayError(data.errorMessage);
      }
      if (this.passwordInput) {
        this.passwordInput.clear();
      }
      this.setState({ isConfirming: false });
    });
  }

  showDialog = () => {
    this.confirmDialog.MDComponent.show();
  }

  setValidPassword = (password) => {
    this.setState({ password });
  }

  render({ selectedBackup }, { password }) {
    return (
      <span>
        <Button
          primary={true}
          raised={true}
          disabled={selectedBackup === null}
          onclick={this.showDialog}>
          Restore
        </Button>
        <Dialog
          ref={confirmDialog => this.confirmDialog = confirmDialog}
          onAccept={this.restore}>
          <Dialog.Header>Restore {selectedBackup}</Dialog.Header>
          <form ref={form => this.form = form} onSubmit={this.restore}>
            <Dialog.Body>
              <div>
                <PasswordRepeatInput
                  ref={ref => this.passwordInput = ref}
                  helptext="Please enter the same password as when the backup was created."
                  helptextPersistent={true}
                  onValidPassword={this.setValidPassword}
                />
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.FooterButton
                type="button"
                cancel={true}>
                Abort
              </Dialog.FooterButton>
              <Dialog.FooterButton
                type="submit"
                disabled={!this.validate()}>
                Restore
              </Dialog.FooterButton>
            </Dialog.Footer>
          </form>
        </Dialog>
        <WaitDialog
          active={this.state.isConfirming}
          title="Restore Backup"
        />
      </span>
    );
  }
}
