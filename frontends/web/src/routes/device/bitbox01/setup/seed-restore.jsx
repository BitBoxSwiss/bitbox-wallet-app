// SPDX-License-Identifier: Apache-2.0

import { Component } from 'react';
import { withTranslation } from 'react-i18next';
import { getDeviceInfo } from '../../../../api/bitbox01';
import { Button } from '../../../../components/forms';
import { Backups } from '../backups';
import { Message } from '../../../../components/message/message';
import { SwissMadeOpenSource, SwissMadeOpenSourceDark, Alert } from '../../../../components/icon';
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

class SeedRestore extends Component {
  state = {
    showInfo: true,
    status: STATUS.CHECKING,
    error: '',
  };

  componentDidMount () {
    this.checkSDcard();
  }

  checkSDcard = () => {
    getDeviceInfo(this.props.deviceID)
      .then((deviceInfo) => {
        if (deviceInfo?.sdcard) {
          return this.setState({ status: STATUS.DEFAULT, error: '' });
        }
        this.setState({
          status: STATUS.ERROR,
          error: this.props.t('seedRestore.error.e200'),
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
      deviceID,
      goBack,
      onSuccess,
    } = this.props;
    const {
      showInfo,
      status,
      error,
    } = this.state;
    return (
      <div className="contentWithGuide">
        <div className="container">
          <div className="innerContainer scrollableContainer">
            <Header title={<h2>{t('welcome.title')}</h2>}>
              <LanguageSwitch />
            </Header>
            <div className="content padded narrow isVerticallyCentered">
              <h1 className={[style.title, 'text-center'].join(' ')}>{t('seedRestore.info.title')}</h1>
              {
                error ? (
                  <Message type={status === STATUS.ERROR ? 'error' : undefined}>
                    <Alert />
                    { error }
                  </Message>
                ) : null
              }
              {
                showInfo ? (
                  <div className="box large">
                    <ol className="first">
                      <li>{t('seedRestore.info.description1')}</li>
                      <li>{t('seedRestore.info.description2')}</li>
                      <li>{t('seedRestore.info.description3')}</li>
                    </ol>
                    <p>{t('seedRestore.info.description4')}</p>
                    <div className="buttons">
                      <Button
                        primary
                        onClick={this.handleStart}
                        disabled={status !== STATUS.DEFAULT}>
                        {t('button.continue')}
                      </Button>
                      <Button
                        secondary
                        onClick={goBack}>
                        {t('button.abort')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Backups
                    showCreate={false}
                    deviceID={deviceID}
                    requireConfirmation={false}
                    onRestore={onSuccess}>
                    <Button
                      secondary
                      onClick={goBack}>
                      {t('button.abort')}
                    </Button>
                  </Backups>
                )
              }
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

export default withTranslation()(SeedRestore);
