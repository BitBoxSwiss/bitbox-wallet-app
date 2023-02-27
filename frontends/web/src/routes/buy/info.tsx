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

import { Component } from 'react';
import { route } from '../../utils/route';
import { AccountCode, IAccount } from '../../api/account';
import { getExchangeBuySupported } from '../../api/exchanges';
import Guide from './guide';
import { GuidedContent, GuideWrapper, Header, Main } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { translate, TranslateProps } from '../../decorators/translate';
import { findAccount, getCryptoName } from '../account/utils';
import { AccountSelector } from '../../components/accountSelector/accountselector';
import { View, ViewContent } from '../../components/view/view';
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

  private handleProceed = () => {
    route(`/buy/exchange/${this.state.selected}`);
  };

  private handleChangeAccount = (selected: string) => {
    this.setState({ selected });
  };

  private checkSupportedCoins = () => {
    Promise.all(
      this.props.accounts.map((account) => (
        getExchangeBuySupported(account.code)()
          .then(supported => (supported.exchanges.length ? account : false))
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
      return <Spinner guideExists={false} text={t('loading')} />;
    }

    const account = findAccount(accounts, code);
    const name = getCryptoName(t('buy.info.crypto'), account);

    return (
      <Main>
        <GuideWrapper>
          <GuidedContent>
            <Header title={<h2>{t('buy.info.title', { name })}</h2>} />
            <View width="550px" verticallyCentered fullscreen={false}>
              <ViewContent>
                { options.length === 0 ? (
                  <div className="content narrow isVerticallyCentered">{t('accountSummary.noAccount')}</div>
                ) : (
                  <AccountSelector title={t('buy.title', { name })} options={options} selected={selected} onChange={this.handleChangeAccount} onProceed={this.handleProceed} />
                )}
              </ViewContent>
            </View>
          </GuidedContent>
          <Guide name={name} />
        </GuideWrapper>
      </Main>
    );
  }
}

const HOC = translate()(BuyInfo);
export { HOC as BuyInfo };
