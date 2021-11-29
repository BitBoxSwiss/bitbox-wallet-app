/**
 * Copyright 2018 Shift Devices AG
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

import { Component, createRef, h, RenderableProps } from 'preact';
import { IAccount } from '../../api/account';
import { TDevices } from '../../api/devices';
import Guide from './guide';
import { Header } from '../../components/layout';
import { load } from '../../decorators/load';
import { translate, TranslateProps } from '../../decorators/translate';
import { Spinner } from '../../components/spinner/Spinner';
import { isBitcoinOnly } from '../account/utils';
import * as style from './moonpay.module.css';

interface BuyProps {
    accounts: IAccount[];
    code: string;
    devices: TDevices;
}

interface LoadedBuyProps {
    moonpay: { url: string, address: string; };
}

interface State {
    height: number;
}

type Props = LoadedBuyProps & BuyProps & TranslateProps;

class Moonpay extends Component<Props, State> {
    private ref = createRef();
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
    }

    private getAccount = (): IAccount | undefined => {
        if (!this.props.accounts) {
            return undefined;
        }
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    private getCryptoName = (): string => {
        const { t } = this.props;
        const account = this.getAccount();
        if (account) {
            return isBitcoinOnly(account.coinCode) ? 'Bitcoin' : t('buy.info.crypto');
        }
        return t('buy.info.crypto');
    }

    public render(
        { moonpay, t }: RenderableProps<Props>,
        { height }: State,
    ) {
        const account = this.getAccount();
        if (!account || moonpay.url === '') {
            return null;
        }
        const name = this.getCryptoName();
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <div class={style.header}>
                        <Header title={<h2>{t('buy.info.title', { name })}</h2>} />
                    </div>
                    <div ref={this.ref} class="innerContainer">
                        <div class="noSpace" style={{ height }}>
                            <Spinner text={t('loading')} />
                            <iframe
                                width="100%"
                                height={height}
                                frameBorder="0"
                                className={style.iframe}
                                allow="camera; payment"
                                src={`${moonpay.url}&colorCode=%235E94BF`}>
                            </iframe>
                        </div>
                    </div>
                </div>
                <Guide t={t} name={name} />
            </div>
        );
    }
}

const loadHOC = load<LoadedBuyProps, BuyProps & TranslateProps>(({ code }) => ({
    moonpay: `exchange/moonpay/buy/${code}`,
}))(Moonpay);
const HOC = translate<BuyProps>()(loadHOC);
export { HOC as Moonpay };
