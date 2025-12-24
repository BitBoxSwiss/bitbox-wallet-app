// SPDX-License-Identifier: Apache-2.0

import { Component } from 'react';
import { route } from '../../../utils/route';
import { apiGet, apiPost } from '../../../utils/request';
import { Button } from '../../../components/forms';
import { PasswordSingleInput } from '../../../components/password';
import { Message } from '../../../components/message/message';
import { AppLogo, AppLogoInverted, SwissMadeOpenSource, SwissMadeOpenSourceDark } from '../../../components/icon/logo';
import { Guide } from '../../../components/guide/guide';
import { Entry } from '../../../components/guide/entry';
import { Header, Footer } from '../../../components/layout';
import { Spinner } from '../../../components/spinner/Spinner';
import { withTranslation } from 'react-i18next';
import { getDarkmode } from '../../../components/darkmode/darkmode';

const stateEnum = Object.freeze({
  DEFAULT: 'default',
  WAITING: 'waiting',
  ERROR: 'error'
});

class Unlock extends Component {
  state = {
    status: stateEnum.DEFAULT,
    errorMessage: '',
    errorCode: null,
    remainingAttempts: null,
    needsLongTouch: false,
    password: '',
  };

  handleFormChange = password => {
    this.setState({ password });
  };

  validate = () => {
    return this.state.password !== '';
  };

  handleSubmit = event => {
    event.preventDefault();
    if (!this.validate()) {
      return;
    }
    this.setState({
      status: stateEnum.WAITING
    });
    apiPost('devices/' + this.props.deviceID + '/login', { password: this.state.password }).then(data => {
      if (data.success) {
        apiGet('devices/' + this.props.deviceID + '/status').then(status => {
          if (status === 'seeded') {
            console.info('unlock.jsx route to /account-summary');
            route('/account-summary', true);
          }
        });
      }
      if (!data.success) {
        if (data.code) {
          this.setState({ errorCode: data.code });
        }
        if (data.remainingAttempts) {
          this.setState({ remainingAttempts: data.remainingAttempts });
        }
        if (data.needsLongTouch) {
          this.setState({ needsLongTouch: data.needsLongTouch });
        }
        this.setState({ status: stateEnum.ERROR, errorMessage: data.errorMessage });
      }
    });
    this.setState({ password: '' });
  };

  render() {
    const { t } = this.props;
    const {
      status,
      errorCode,
      errorMessage,
      remainingAttempts,
      needsLongTouch,
    } = this.state;
    let submissionState = null;
    switch (status) {
    case stateEnum.DEFAULT:
      submissionState = <p>{t('unlock.description')}</p>;
      break;
    case stateEnum.WAITING:
      submissionState = <Spinner guideExists text={t('unlock.unlocking')} />;
      break;
    case stateEnum.ERROR:
      submissionState = (
        <Message type="error">
          {t(`unlock.error.e${errorCode}`, {
            defaultValue: errorMessage,
            remainingAttempts,
            context: needsLongTouch ? 'touch' : 'normal'
          })}
        </Message>
      );
      break;
    default:
      break;
    }

    const darkmode = getDarkmode();
    return (
      <div className="contentWithGuide">
        <div className="container">
          <div className="innerContainer scrollableContainer">
            <Header title={<h2>{t('welcome.title')}</h2>} />
            <div className="content narrow padded isVerticallyCentered">
              {darkmode ? <AppLogoInverted /> : <AppLogo />}
              <div className="box large">
                {submissionState}
                {
                  status !== stateEnum.WAITING && (
                    <form onSubmit={this.handleSubmit}>
                      <div className="m-top-default">
                        <PasswordSingleInput
                          autoFocus
                          id="password"
                          label={t('unlock.input.label')}
                          disabled={status === stateEnum.WAITING}
                          placeholder={t('unlock.input.placeholder')}
                          onValidPassword={this.handleFormChange}/>
                      </div>
                      <div className="buttons">
                        <Button
                          primary
                          type="submit"
                          disabled={!this.validate() || status === stateEnum.WAITING}>
                          {t('button.unlock')}
                        </Button>
                      </div>
                    </form>
                  )
                }
              </div>
            </div>
            <Footer>
              {darkmode ? <SwissMadeOpenSourceDark /> : <SwissMadeOpenSource />}
            </Footer>
          </div>
        </div>
        <Guide>
          <Entry key="guide.unlock.forgotDevicePassword" entry={{
            text: t('guide.unlock.forgotDevicePassword.text'),
            title: t('guide.unlock.forgotDevicePassword.title'),
          }} />
          <Entry key="guide.unlock.reset" entry={{
            text: t('guide.unlock.reset.text'),
            title: t('guide.unlock.reset.title'),
          }} />
        </Guide>
      </div>
    );
  }
}

export default withTranslation()(Unlock);
