/**
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

import React, { Component } from 'react';
import { route } from '../../utils/route';
import { AccountCode, IAccount } from '../../api/account';
import { isExchangeBuySupported } from '../../api/exchanges';
import Guide from './guide';
import { Header } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { translate, TranslateProps } from '../../decorators/translate';
import { Button, Select } from '../../components/forms';
import { findAccount, getCryptoName } from '../account/utils';
import style from './info.module.css';

interface BuyInfoProps {
    accounts: IAccount[];
    code: string;
}

interface Option {
    text: string;
    value: AccountCode;
}

interface State {
    selected?: string;
    options?: Option[]
}

type Props = BuyInfoProps & TranslateProps;

class BuyInfo extends Component<Props, State> {
  public readonly state: State = {
    selected: this.props.code,
  };

  componentDidMount = () => {
    this.checkSupportedCoins();
  };

  private maybeProceed = () => {
    if (this.state.options !== undefined && this.state.options.length === 1) {
      route(`/buy/exchange/${this.state.options[0].value}`);
    }
  };

  // TODO add pocket supported coins
  private checkSupportedCoins = () => {
    Promise.all(
      this.props.accounts.map((account) => (
        isExchangeBuySupported(account.code)
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
  };

  public render() {
    const { t, accounts, code } = this.props;
    const {
      selected,
      options,
    } = this.state;
    if (options === undefined) {
      return <Spinner text={t('loading')} />;
    }

    const account = findAccount(accounts, code);
    const name = getCryptoName(t('buy.info.crypto'), account);

    return (
      <div className="contentWithGuide">
        <div className="container">
          <Header title={<h2>{t('buy.info.title', { name })}</h2>} />
          <div className="innerContainer">
            { options.length === 0 ? (
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
                    onClick={() => route(`/buy/exchange/${selected}`)}
                    disabled={!selected}>
                    {t('buy.info.next')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Guide name={name} />
      </div>
    );
  }
}

const HOC = translate()(BuyInfo);
export { HOC as BuyInfo };
