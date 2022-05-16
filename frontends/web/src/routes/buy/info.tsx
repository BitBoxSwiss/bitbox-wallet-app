/**
 * Copyright 2021 Shift Crypto AG
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

import React, { ChangeEvent, Component } from 'react';
import { route } from '../../utils/route';
import { AccountCode, IAccount } from '../../api/account';
import { TDevices } from '../../api/devices';
import Guide from './guide';
import A from '../../components/anchor/anchor';
import { Header } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { load } from '../../decorators/load';
import { translate, TranslateProps } from '../../decorators/translate';
import { Button, Checkbox, Select } from '../../components/forms';
import { setConfig } from '../../utils/config';
import { apiGet } from '../../utils/request';
import { isBitcoinOnly } from '../account/utils';
import style from './info.module.css';

interface BuyInfoProps {
    accounts: IAccount[];
    code?: string;
    devices: TDevices;
}

interface LoadedBuyInfoProps {
    config: any;
}

interface Option {
    text: string;
    value: AccountCode;
}

interface State {
    status: 'choose' | 'agree'
    selected?: string;
    options?: Option[]
}

type Props = BuyInfoProps & LoadedBuyInfoProps & TranslateProps;

class BuyInfo extends Component<Props, State> {
  public readonly state: State = {
    status: this.props.config.frontend.skipBuyDisclaimer ? 'choose' : 'agree',
    selected: this.props.code,
  }

  componentDidMount = () => {
    this.checkSupportedCoins();
  }

  private handleProceed = () => {
    const { status, selected } = this.state;
    if (selected && (status === 'choose' || this.props.config.frontend.skipBuyDisclaimer)) {
      route(`/buy/moonpay/${selected}`);
    } else {
      this.setState({ status: 'choose' }, this.maybeProceed);
    }
  }

  private maybeProceed = () => {
    if (this.state.status === 'choose' && this.state.options !== undefined && this.state.options.length === 1) {
      route(`/buy/moonpay/${this.state.options[0].value}`);
    }
  }

  private checkSupportedCoins = () => {
    Promise.all(
      this.props.accounts.map((account) => (
        apiGet(`exchange/moonpay/buy-supported/${account.code}`)
          .then(isSupported => (isSupported ? account : false))
      ))
    )
      .then(results => results.filter(result => result))
    // @ts-ignore
      .then(accounts => accounts.map(({ isToken, name, coinName, code }) => ({ text: isToken || name === coinName ? name : `${name} (${coinName})`, value: code })))
      .then(options => {
        this.setState({ options }, this.maybeProceed);
      })
      .catch(console.error);
  }

  private handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
    setConfig({ frontend: { skipBuyDisclaimer: e.target.checked } });
  }

  private getCryptoName = (): string => {
    const { accounts, code, t } = this.props;
    if (!code) {
      const onlyBitcoin = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
      return onlyBitcoin ? 'Bitcoin' : t('buy.info.crypto');
    }
    const account = accounts.find(account => account.code === code);
    if (account) {
      return isBitcoinOnly(account.coinCode) ? 'Bitcoin' : t('buy.info.crypto');
    }
    return t('buy.info.crypto');
  }

  public render() {
    const { t } = this.props;
    const {
      status,
      selected,
      options,
    } = this.state;
    if (options === undefined) {
      return <Spinner text={t('loading')} />;
    }
    const name = this.getCryptoName();
    return (
      <div className="contentWithGuide">
        <div className="container">
          <Header title={<h2>{t('buy.info.title', { name })}</h2>} />
          <div className="innerContainer">
            { status === 'agree' ? (
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
                    onClick={this.handleProceed}>
                    {t('buy.info.continue')}
                  </Button>
                </div>
              </div>
            ) : (
              options.length === 0 ? (
                <div className="content narrow isVerticallyCentered">{t('accountSummary.noAccount')}</div>
              ) : (
                <div className="content narrow isVerticallyCentered">
                  <h1 className={style.title}>{t('buy.title', { name })}</h1>
                  <Select
                    options={[{
                      text: t('buy.info.selectLabel'),
                      disabled: true,
                      value: 'choose',
                    },
                    ...options]
                    }
                    onChange={(e: React.SyntheticEvent) => this.setState({ selected: (e.target as HTMLSelectElement).value })}
                    value={selected || 'choose'}
                    id="coinAndAccountCode"
                  />
                  <div className="buttons text-center m-bottom-xxlarge">
                    <Button
                      primary
                      onClick={this.handleProceed}
                      disabled={!selected}>
                      {t('buy.info.next')}
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
        <Guide t={t} name={name} />
      </div>
    );
  }
}

const loadHOC = load<LoadedBuyInfoProps, BuyInfoProps & TranslateProps>({
  config: 'config'
})(BuyInfo);

const HOC = translate()(loadHOC);
export { HOC as BuyInfo };
