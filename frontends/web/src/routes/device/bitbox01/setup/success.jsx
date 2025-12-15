// SPDX-License-Identifier: Apache-2.0

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
                {getDarkmode() ? <SwissMadeOpenSourceDark /> : <SwissMadeOpenSource />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default withTranslation()(Success);
