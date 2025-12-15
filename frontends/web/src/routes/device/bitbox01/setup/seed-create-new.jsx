// SPDX-License-Identifier: Apache-2.0

import { Component, createRef } from 'react';
import { withTranslation } from 'react-i18next';
import { getDeviceInfo } from '../../../../api/bitbox01';
import { apiPost } from '../../../../utils/request';
import { PasswordRepeatInput } from '../../../../components/password';
import { Button, Input, Checkbox } from '../../../../components/forms';
import { Message } from '../../../../components/message/message';
import { SwissMadeOpenSource, SwissMadeOpenSourceDark, Alert, Warning } from '../../../../components/icon';
import { Header } from '../../../../components/layout';
import { Spinner } from '../../../../components/spinner/Spinner';
import { LanguageSwitch } from '../../../../components/language/language';
import { getDarkmode } from '../../../../components/darkmode/darkmode';
import style from '../bitbox01.module.css';

const STATUS = Object.freeze({
  DEFAULT: 'default',
  CREATING: 'creating',
  CHECKING: 'checking',
  ERROR: 'error',
});

class SeedCreateNew extends Component {
  state = {
    showInfo: true,
    status: STATUS.CHECKING,
    walletName: '',
    backupPassword: '',
    error: '',
    agreements: {
      password_change: false,
      password_required: false,
      funds_access: false,
    },
  };

  walletNameInput = createRef();

  componentDidMount () {
    this.checkSDcard();
  }

  validate = () => {
    if (!this.walletNameInput.current || !this.walletNameInput.current.validity.valid || !this.validAgreements()) {
      return false;
    }
    return this.state.backupPassword && this.state.walletName !== '';
  };

  handleFormChange = ({ target }) => {
    this.setState({ [target.id]: target.value });
  };

  handleSubmit = event => {
    event.preventDefault();
    if (!this.validate()) {
      return;
    }
    this.setState({ status: STATUS.CREATING, error: '' });
    apiPost('devices/' + this.props.deviceID + '/create-wallet', {
      walletName: this.state.walletName,
      backupPassword: this.state.backupPassword
    }).then(data => {
      if (!data.success) {
        this.setState({
          status: STATUS.ERROR,
          error: this.props.t(`seed.error.e${data.code}`, {
            defaultValue: data.errorMessage
          }),
        });
      } else {
        this.props.onSuccess();
      }
      this.setState({ backupPassword: '' });
    });
  };

  setValidBackupPassword = backupPassword => {
    this.setState({ backupPassword });
  };

  validAgreements = () => {
    const { agreements } = this.state;
    const invalid = Object.keys(agreements).map(agr => agreements[agr]).includes(false);
    return !invalid;
  };

  handleAgreementChange = ({ target }) => {
    this.setState(state => ({ agreements: {
      ...state.agreements,
      [target.id]: target.checked
    } }));
  };

  checkSDcard = () => {
    getDeviceInfo(this.props.deviceID)
      .then((deviceInfo) => {
        if (deviceInfo?.sdcard) {
          return this.setState({ status: STATUS.DEFAULT, error: '' });
        }
        this.setState({
          status: STATUS.ERROR,
          error: this.props.t('seed.error.e200'),
        });
        setTimeout(this.checkSDcard, 2500);
      });
  };

  handleStart = () => {
    this.setState({ showInfo: false });
    this.checkSDcard();
  };

  renderSpinner() {
    switch (this.state.status) {
    case STATUS.CHECKING:
      return (
        <Spinner guideExists={false} text={this.props.t('checkSDcard')} />
      );
    case STATUS.CREATING:
      return (
        <Spinner guideExists={false} text={this.props.t('seed.creating')} />
      );
    default:
      return null;
    }
  }

  render() {
    const {
      t,
      goBack,
    } = this.props;
    const {
      showInfo,
      status,
      walletName,
      error,
      agreements,
    } = this.state;
    const content = showInfo ? (
      <div className="box large">
        <ol className="first">
          <li>{t('seed.info.description1')}</li>
          <li>{t('seed.info.description2')}</li>
        </ol>
        <p>{t('seed.info.description3')}</p>
        <p>{t('seed.info.description4')}</p>
        <div className="buttons">
          <Button
            primary
            onClick={this.handleStart}
            disabled={status !== STATUS.DEFAULT}>
            {t('seed.info.button')}
          </Button>
          <Button
            secondary
            onClick={goBack}>
            {t('button.abort')}
          </Button>
        </div>
      </div>
    ) : (
      <form onSubmit={this.handleSubmit} className="box large">
        <div>
          <Input
            pattern="^[0-9a-zA-Z-_]{1,31}$"
            autoFocus
            id="walletName"
            label={t('seed.walletName.label')}
            disabled={status === STATUS.CREATING}
            onInput={this.handleFormChange}
            ref={this.walletNameInput}
            value={walletName} />
          <PasswordRepeatInput
            label={t('seed.password.label')}
            repeatPlaceholder={t('seed.password.repeatPlaceholder')}
            disabled={status === STATUS.CREATING}
            onValidPassword={this.setValidBackupPassword} />
        </div>
        <div className={style.agreements}>
          <div className="flex flex-row flex-start flex-items-center">
            <Warning style={{ width: 18, marginRight: 10, position: 'relative', bottom: 1 }} />
            <p className={style.agreementsLabel}>{t('seed.description')}</p>
          </div>
          <Checkbox
            id="password_change"
            label={t('seed.agreements.password-change')}
            checked={agreements.password_change}
            onChange={this.handleAgreementChange} />
          <Checkbox
            id="password_required"
            label={t('seed.agreements.password-required')}
            checked={agreements.password_required}
            onChange={this.handleAgreementChange} />
          <Checkbox
            id="funds_access"
            label={t('seed.agreements.funds-access')}
            checked={agreements.funds_access}
            onChange={this.handleAgreementChange} />
        </div>
        <div className="buttons">
          <Button
            type="submit"
            primary
            disabled={!this.validate() || status === STATUS.CREATING}>
            {t('seed.create')}
          </Button>
          <Button
            secondary
            onClick={goBack}>
            {t('button.abort')}
          </Button>
        </div>
      </form>
    );

    return (
      <div className="contentWithGuide">
        <div className="container">
          <div className="innerContainer scrollableContainer">
            <Header title={<h2>{t('welcome.title')}</h2>}>
              <LanguageSwitch />
            </Header>
            <div className="content padded narrow isVerticallyCentered">
              <h1 className={[style.title, 'text-center'].join(' ')}>{t('seed.info.title')}</h1>
              {
                error && (
                  <Message type={status === STATUS.ERROR ? 'error' : undefined}>
                    <Alert />
                    { error }
                  </Message>
                )
              }
              {content}
              <div className="text-center m-top-large">
                {getDarkmode() ? <SwissMadeOpenSourceDark /> : <SwissMadeOpenSource />}
              </div>
            </div>
          </div>
          { this.renderSpinner() }
        </div>
      </div>
    );
  }
}

export default withTranslation()(SeedCreateNew);
