/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
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

import { Component, createRef, ChangeEvent } from 'react';
import { IAccount } from '../../api/account';
import Guide from './guide';
import { Header } from '../../components/layout';
import { load } from '../../decorators/load';
import { translate, TranslateProps } from '../../decorators/translate';
import { Spinner } from '../../components/spinner/Spinner';
import { findAccount, getCryptoName } from '../account/utils';
import { Button, Checkbox } from '../../components/forms';
import { setConfig } from '../../utils/config';
import A from '../../components/anchor/anchor';
import style from './moonpay.module.css';

type TBuyProps = {
    accounts: IAccount[];
    code: string;
}

type TLoadedBuyProps = {
    moonpay: { url: string, address: string; };
    config: any;
}

type State = {
  agreedTerms: boolean;
  height?: number;
  iframeLoaded: boolean;
}

type Props = TLoadedBuyProps & TBuyProps & TranslateProps;

class Moonpay extends Component<Props, State> {
  public readonly state: State = {
    agreedTerms: this.props.config.frontend.skipBuyDisclaimer,
    iframeLoaded: false,
  };

  private ref = createRef<HTMLDivElement>();
  private resizeTimerID?: any;

  public componentDidMount() {
    window.addEventListener('resize', this.onResize);
  }

  public componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
  }

  private handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
    setConfig({ frontend: { skipBuyDisclaimer: e.target.checked } });
  };

  private agreeTerms = () => {
    this.setState({ agreedTerms: true });
  };

  private onResize = () => {
    if (this.resizeTimerID) {
      clearTimeout(this.resizeTimerID);
    }
    this.resizeTimerID = setTimeout(() => {
      if (!this.ref.current) {
        return;
      }
      this.setState({ height: this.ref.current.offsetHeight });
    }, 200);
  };

  public render() {
    const { moonpay, t } = this.props;
    const { agreedTerms, height, iframeLoaded } = this.state;
    const account = findAccount(this.props.accounts, this.props.code);
    if (!account || moonpay.url === '') {
      return null;
    }

    const name = getCryptoName(t('buy.info.crypto'), account);
    return (

      <div className="contentWithGuide">
        <div className="container">
          <div className="innerContainer">
            <div className={style.header}>
              <Header title={<h2>{t('buy.info.title', { name })}</h2>} />
            </div>
            { !agreedTerms ? (
              <div className={style.disclaimerContainer}>
                <div className={style.disclaimer}>
                  <h2 className={style.title}>
                    {t('buy.info.disclaimer.title', { name })}
                  </h2>
                  <p>{t('buy.info.disclaimer.intro.0', { name })}</p>
                  <p>{t('buy.info.disclaimer.intro.1', { name })}</p>
                  <h2 className={style.title}>
                    {t('buy.info.disclaimer.payment.title')}
                  </h2>
                  <p>{t('buy.info.disclaimer.payment.details', { name })}</p>
                  <div className={style.table}>
                    <table>
                      <colgroup>
                        <col width="*" />
                        <col width="50px" />
                        <col width="*" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>{t('buy.info.disclaimer.payment.table.method')}</th>
                          <th>{t('buy.info.disclaimer.payment.table.fee')}</th>
                          <th>{t('buy.info.disclaimer.payment.table.description')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{t('buy.info.disclaimer.payment.table.1_method')}</td>
                          <td className={style.nowrap}>1.9 %</td>
                          <td>{t('buy.info.disclaimer.payment.table.1_description')}</td>
                        </tr>
                        <tr>
                          <td>{t('buy.info.disclaimer.payment.table.2_method')}</td>
                          <td className={style.nowrap}>4.9 %</td>
                          <td>{t('buy.info.disclaimer.payment.table.2_description')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p>{t('buy.info.disclaimer.payment.footnote')}</p>
                  <h2 className={style.title}>
                    {t('buy.info.disclaimer.security.title')}
                  </h2>
                  <p>{t('buy.info.disclaimer.security.description', { name })}</p>
                  <p>
                    <A className={style.link} href="https://shiftcrypto.ch/bitbox02/threat-model/">
                      {t('buy.info.disclaimer.security.link')}
                    </A>
                  </p>
                  <h2 className={style.title}>
                    {t('buy.info.disclaimer.protection.title')}
                  </h2>
                  <p>{t('buy.info.disclaimer.protection.description', { name })}</p>
                  <p>
                    <A className={style.link} href="https://www.moonpay.com/privacy_policy">
                      {t('buy.info.disclaimer.privacyPolicy')}
                    </A>
                  </p>
                </div>
                <div className="text-center m-bottom-quarter">
                  <Checkbox
                    id="skip_disclaimer"
                    label={t('buy.info.skip')}
                    onChange={this.handleSkipDisclaimer} />
                </div>
                <div className="buttons text-center m-bottom-xlarge">
                  <Button
                    primary
                    onClick={this.agreeTerms}>
                    {t('buy.info.continue')}
                  </Button>
                </div>
              </div>
            ) : (
              <div ref={this.ref} className="iframeContainer">
                {!iframeLoaded && <Spinner text={t('loading')} />}
                <iframe
                  onLoad={() => {
                    this.setState({ iframeLoaded: true });
                    this.onResize();
                  }}
                  title="Moonpay"
                  width="100%"
                  height={iframeLoaded ? height : 0}
                  frameBorder="0"
                  className={style.iframe}
                  allow="camera; payment"
                  src={`${moonpay.url}&colorCode=%235E94BF`}>
                </iframe>
              </div>
            )}
          </div>
        </div>
        <Guide name={name} />
      </div>
    );
  }
}

const loadHOC = load<TLoadedBuyProps, TBuyProps & TranslateProps>(({ code }) => ({
  moonpay: `exchange/moonpay/buy/${code}`,
  config: 'config',
}))(Moonpay);
const HOC = translate()(loadHOC);
export { HOC as Moonpay };
