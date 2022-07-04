/**
 * Copyright 2018 Shift Devices AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component } from 'react';
import { withTranslation } from 'react-i18next';
import { apiGet } from '../../../../utils/request';
import { Button } from '../../../../components/forms';
import { Backups } from '../backups';
import { Message } from '../../../../components/message/message';
import { SwissMadeOpenSource, Alert } from '../../../../components/icon';
import { Header } from '../../../../components/layout';
import { Spinner } from '../../../../components/spinner/Spinner';
import { LanguageSwitch } from '../../../../components/language/language';
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

  displayError = error => {
    this.setState({
      status: STATUS.ERROR,
      error,
    });
  };

  checkSDcard = () => {
    apiGet('devices/' + this.props.deviceID + '/info').then(({ sdcard }) => {
      if (sdcard) {
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
      return (<Spinner text={this.props.t('checkSDcard')} />);
    case STATUS.CREATING:
      return (<Spinner text={this.props.t('seed.creating')} />);
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
          <Header title={<h2>{t('welcome.title')}</h2>}>
            <LanguageSwitch />
          </Header>
          <div className="innerContainer scrollableContainer">
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
                        {t('seedRestore.info.button')}
                      </Button>
                      <Button
                        transparent
                        onClick={goBack}>
                        {t('button.abort')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Backups
                    showCreate={false}
                    displayError={this.displayError}
                    deviceID={deviceID}
                    requireConfirmation={false}
                    onRestore={onSuccess}
                    fillSpace>
                    <Button
                      transparent
                      onClick={goBack}>
                      {t('button.abort')}
                    </Button>
                  </Backups>
                )
              }
              <div className="text-center m-top-large">
                <SwissMadeOpenSource large />
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
