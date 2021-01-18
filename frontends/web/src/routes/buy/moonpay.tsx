/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2020 Shift Crypto AG
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
import Guide from './guide';
import { Header } from '../../components/layout';
import { load } from '../../decorators/load';
import { translate, TranslateProps } from '../../decorators/translate';
import { Devices } from '../device/deviceswitch';
import { AccountInterface } from '../account/account';
import { Spinner } from '../../components/spinner/Spinner';
import * as style from './moonpay.css';

interface BuyProps {
    accounts: AccountInterface[];
    code?: string;
    devices: Devices;
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

    private getAccount = () => {
        if (!this.props.accounts) {
            return undefined;
        }
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    public render(
        { code,
            moonpay,
          t }: RenderableProps<Props>,
        { height }: State,
    ) {
        const account = this.getAccount();
        if (!account) {
            return null;
        }
        const name = code === 'btc' || code === 'tbtc' ? 'Bitcoin' : 'crypto';
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header />
                    <div ref={this.ref} class="innerContainer">
                        <div class="content noSpace" style={{ height }}>
                            <Spinner text={t('loading')} />
                            <iframe
                                width="100%"
                                height={height}
                                frameBorder="0"
                                className={style.iframe}
                                allow="payment"
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
    moonpay: `account/${code}/exchange/moonpay/buy`,
}))(Moonpay);
const HOC = translate<BuyProps>()(loadHOC);
export { HOC as Moonpay };
