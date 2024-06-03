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

import { Component, SyntheticEvent } from 'react';
import { Button } from '../../../../components/forms';
import { SwissMadeOpenSource, SwissMadeOpenSourceDark } from '../../../../components/icon/logo';
import { LanguageSwitch } from '../../../../components/language/language';
import { Header } from '../../../../components/layout';
import { Message } from '../../../../components/message/message';
import { PasswordRepeatInput } from '../../../../components/password';
import { Spinner } from '../../../../components/spinner/Spinner';
import { translate, TranslateProps } from '../../../../decorators/translate';
import { apiPost } from '../../../../utils/request';
import { getDarkmode } from '../../../../components/darkmode/darkmode';
import style from '../bitbox01.module.css';

const stateEnum = Object.freeze({
  DEFAULT: 'default',
  WAITING: 'waiting',
  ERROR: 'error',
});

interface InitializeProps {
    goBack: () => void;
    deviceID: string;
}

type Props = InitializeProps & TranslateProps;

interface State {
    showInfo: boolean;
    password: string | null;
    status: string;
    errorCode: string | null;
    errorMessage: string;
}

class Initialize extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showInfo: true,
      password: null,
      status: stateEnum.DEFAULT,
      errorCode: null,
      errorMessage: '',
    };
  }

  private handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!this.state.password) {
      return;
    }
    this.setState({
      status: stateEnum.WAITING,
      errorCode: null,
      errorMessage: '',
    });
    apiPost('devices/' + this.props.deviceID + '/set-password', {
      password: this.state.password,
    }).then(data => {
      if (!data.success) {
        if (data.code) {
          this.setState({ errorCode: data.code });
        }
        this.setState({
          status: stateEnum.ERROR,
          errorMessage: data.errorMessage,
        });
      }
    });
  };

  private setValidPassword = (password: string | null) => {
    this.setState({ password });
  };

  private handleStart = () => {
    this.setState({ showInfo: false });
  };

  public render() {
    const { t, goBack } = this.props;
    const { showInfo, password, status, errorCode, errorMessage } = this.state;
    let formSubmissionState;
    switch (status) {
    case stateEnum.DEFAULT:
      formSubmissionState = null;
      break;
    case stateEnum.WAITING:
      formSubmissionState = <Message type="info">{t('initialize.creating')}</Message>;
      break;
    case stateEnum.ERROR:
      formSubmissionState = (
        <Message type="error">
          {t(`initialize.error.e${errorCode}`, {
            defaultValue: errorMessage,
          })}
        </Message>
      );
    }

    const content = showInfo ? (
      <div className="box large">
        <h3 className="subTitle">{t('initialize.info.subtitle')}</h3>
        <ul>
          <li>{t('initialize.info.description1')}</li>
          <li>{t('initialize.info.description2')}</li>
        </ul>
        <p>{t('initialize.info.description3')}</p>
        <div className="buttons">
          <Button primary onClick={this.handleStart}>
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
      <form onSubmit={this.handleSubmit} className="box large">
        <PasswordRepeatInput
          pattern="^.{4,}$"
          label={t('initialize.input.label')}
          repeatLabel={t('initialize.input.labelRepeat')}
          repeatPlaceholder={t('initialize.input.placeholderRepeat')}
          disabled={status === stateEnum.WAITING}
          onValidPassword={this.setValidPassword} />
        <div className="buttons">
          <Button
            type="submit"
            primary
            disabled={!password || status === stateEnum.WAITING}>
            {t('initialize.create')}
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
          <Header title={<h2>{t('welcome.title')}</h2>}>
            <LanguageSwitch />
          </Header>
          <div className="innerContainer">
            <div className="content padded narrow isVerticallyCentered">
              <h1 className={[style.title, 'text-center'].join(' ')}>{t(showInfo ? 'initialize.info.title' : 'setup')}</h1>
              {formSubmissionState}
              {content}
              <div className="text-center m-top-large">
                {getDarkmode() ? <SwissMadeOpenSourceDark large /> : <SwissMadeOpenSource large />}
              </div>
            </div>
          </div>
          {
            status === stateEnum.WAITING && (
              <Spinner guideExists={false} text={t('initialize.creating')} />
            )
          }
        </div>
      </div>
    );
  }
}

const TranslatedInitialize = translate()(Initialize);
export { TranslatedInitialize as Initialize };
