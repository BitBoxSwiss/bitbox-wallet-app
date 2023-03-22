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
import { Button } from '../../../../components/forms';
import { Alert, SwissMadeOpenSource, SwissMadeOpenSourceDark } from '../../../../components/icon';
import { LanguageSwitch } from '../../../../components/language/language';
import { Header } from '../../../../components/layout';
import { Message } from '../../../../components/message/message';
import { translate, TranslateProps } from '../../../../decorators/translate';
import { SimpleMarkup } from '../../../../utils/markup';
import { getDarkmode } from '../../../../components/darkmode/darkmode';
import style from '../bitbox01.module.css';

interface SecurityInformationProps {
    goBack: () => void;
    goal: string | null;
}

type Props = SecurityInformationProps & TranslateProps;

interface State {
    showInfo: boolean;
}

class SecurityInformation extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showInfo: true,
    };
  }

  private handleStart = () => {
    this.setState({ showInfo: false });
  };

  public render() {
    const { t, goBack, goal, children } = this.props;
    const { showInfo } = this.state;
    if (!showInfo) {
      return children;
    }
    return (
      <div className="contentWithGuide">
        <div className="container">
          <Header title={<h2>{t('welcome.title')}</h2>}>
            <LanguageSwitch />
          </Header>
          <div className="innerContainer">
            <div className="content padded narrow isVerticallyCentered">
              <h1 className={[style.title, 'text-center'].join(' ')}>{t(`securityInformation.${goal}.title`)}</h1>
              {
                goal === 'create' ? (
                  <div className="box large">
                    <SimpleMarkup tagName="p" markup={t('securityInformation.create.description1')} />
                    <SimpleMarkup tagName="p" markup={t('securityInformation.create.description2')} />
                    <ul className={[style.list, 'first'].join(' ')}>
                      <SimpleMarkup tagName="li" markup={t('securityInformation.create.description3')} />
                      <SimpleMarkup tagName="li" markup={t('securityInformation.create.description4')} />
                    </ul>
                    <SimpleMarkup tagName="p" markup={t('securityInformation.create.description5')} />
                    <div className="buttons">
                      <Button primary onClick={this.handleStart}>
                        {t('button.continue')}
                      </Button>
                      <Button
                        transparent
                        onClick={goBack}>
                        {t('button.abort')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="box large">
                    <ul className={[style.list, 'first'].join(' ')}>
                      <li>{t('securityInformation.restore.description1')}</li>
                      <li>{t('securityInformation.restore.description2')}</li>
                    </ul>
                    <p>{t('securityInformation.restore.description3')}</p>
                    <Message type="warning">
                      <Alert />
                      <p className="first">{t('deviceTampered')}</p>
                    </Message>
                    <div className="buttons">
                      <Button primary onClick={this.handleStart}>
                        {t('button.continue')}
                      </Button>
                      <Button
                        transparent
                        onClick={goBack}>
                        {t('button.abort')}
                      </Button>
                    </div>
                  </div>
                )
              }
              <div className="text-center m-top-large">
                {getDarkmode() ? <SwissMadeOpenSourceDark large /> : <SwissMadeOpenSource large />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const translatedSecutiryInformation = translate()(SecurityInformation);
export { translatedSecutiryInformation as SecurityInformation };
