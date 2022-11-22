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

import { Component, createRef } from 'react';
import { IAccount } from '../../api/account';
import Guide from './guide';
import { Header } from '../../components/layout';
import { load } from '../../decorators/load';
import { translate, TranslateProps } from '../../decorators/translate';
import { Spinner } from '../../components/spinner/Spinner';
import { isBitcoinOnly } from '../account/utils';
import style from './moonpay.module.css';

type TBuyProps = {
    accounts: IAccount[];
    code: string;
}

type TLoadedBuyProps = {
    moonpay: { url: string, address: string; };
}

type State = {
  height?: number;
  iframeLoaded: boolean;
}

type Props = TLoadedBuyProps & TBuyProps & TranslateProps;

class Moonpay extends Component<Props, State> {
  public readonly state: State = {
    iframeLoaded: false
  };

  private ref = createRef<HTMLDivElement>();
  private resizeTimerID?: any;

  public componentDidMount() {
    this.onResize();
    window.addEventListener('resize', this.onResize);
  }

  public componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
  }

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

  private getAccount = (): IAccount | undefined => {
    if (!this.props.accounts) {
      return undefined;
    }
    return this.props.accounts.find(({ code }) => code === this.props.code);
  };

  private getCryptoName = (): string => {
    const { t } = this.props;
    const account = this.getAccount();
    if (account) {
      return isBitcoinOnly(account.coinCode) ? 'Bitcoin' : t('buy.info.crypto');
    }
    return t('buy.info.crypto');
  };


  public render() {
    const { moonpay, t } = this.props;
    const { height, iframeLoaded } = this.state;
    const account = this.getAccount();

    if (!account || moonpay.url === '') {
      return null;
    }

    const name = this.getCryptoName();
    return (
      <div className="contentWithGuide">
        <div className="container">
          <div ref={this.ref} className="innerContainer scrollableContainer">
            <div className={style.header}>
              <Header title={<h2>{t('buy.info.title', { name })}</h2>} />
            </div>
            <div ref={this.ref} className="innerContainer">
              <div className="noSpace">
                {!iframeLoaded && <Spinner text={t('loading')} />}
                <iframe
                  onLoad={() => {
                    this.setState({ iframeLoaded: true });
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
            </div>
          </div>
        </div>
        <Guide name={name} />
      </div>
    );
  }
}

const loadHOC = load<TLoadedBuyProps, TBuyProps & TranslateProps>(({ code }) => ({
  moonpay: `exchange/moonpay/buy/${code}`,
}))(Moonpay);
const HOC = translate()(loadHOC);
export { HOC as Moonpay };
