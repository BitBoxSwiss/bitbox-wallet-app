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
import { route } from '../../../../utils/route';
import { withTranslation } from 'react-i18next';
import { SwissMadeOpenSource, SwissMadeOpenSourceDark } from '../../../../components/icon';
import { LanguageSwitch } from '../../../../components/language/language';
import { Header } from '../../../../components/layout';
import { Button } from '../../../../components/forms';
import { getDarkmode } from '../../../../components/darkmode/darkmode';
import style from '../bitbox01.module.css';

class Success extends Component {

  handleGetStarted = () => {
    route('/account-summary', true);
  };

  render() {
    const {
      t,
      handleHideSuccess,
      goal,
    } = this.props;
    return (
      <div className="contentWithGuide">
        <div className="container">
          <div className="innerContainer scrollableContainer">
            <Header title={<h2>{t('welcome.title')}</h2>}>
              <LanguageSwitch />
            </Header>
            <div className="content padded narrow isVerticallyCentered">
              <h1 className={[style.title, 'text-center'].join(' ')}>{t(`success.${goal}.title`)}</h1>
              <div className="box large">
                <p style={{ textAlign: 'center' }}>
                  {t(`success.${goal}.summary`)}
                </p>
                { goal === 'create' ? (
                  <ul className={style.summary}>
                    <li>{t('success.create.info1')}</li>
                    <li>{t('success.create.info2')}</li>
                    <li>{t('success.create.info3')}</li>
                  </ul>
                ) : null}
                <div className="buttons">
                  <Button primary onClick={this.handleGetStarted}>
                    {t('success.getstarted')}
                  </Button>
                  <Button secondary onClick={handleHideSuccess}>
                    {t('sidebar.device')}
                  </Button>
                </div>
              </div>
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

export default withTranslation()(Success);
