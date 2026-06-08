// SPDX-License-Identifier: Apache-2.0

import { Component } from 'react';
import { withTranslation } from 'react-i18next';
import { Button } from '../../../../components/forms';
import { SwissMadeOpenSource, SwissMadeOpenSourceDark } from '../../../../components/icon/logo';
import { Header } from '../../../../components/layout';
import { LanguageSwitch } from '../../../../components/language/language';
import { getDarkmode } from '../../../../components/darkmode/darkmode';

class Goal extends Component {
  render() {
    const {
      t,
      onCreate,
      onRestore,
    } = this.props;
    return (
      <div className="contentWithGuide">
        <div className="container">
          <Header title={<h2>{t('welcome.title')}</h2>}>
            <LanguageSwitch />
          </Header>
          <div className="innerContainer">
            <div className="content padded narrow isVerticallyCentered">
              <div className="box large">
                <p className="first">{t('goal.paragraph')}</p>
                <div className="buttons">
                  <Button primary onClick={onCreate}>
                    {t('goal.buttons.create')}
                  </Button>
                  <Button secondary onClick={onRestore}>
                    {t('goal.buttons.restore')}
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

export default withTranslation()(Goal);
