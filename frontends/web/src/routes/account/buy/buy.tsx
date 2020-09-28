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

import { Component, h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import { alertUser } from '../../../components/alert/Alert';
import { Balance, BalanceInterface } from '../../../components/balance/balance';
import { Button, ButtonLink } from '../../../components/forms';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { Header } from '../../../components/layout';
import { load } from '../../../decorators/load';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { Devices } from '../../device/deviceswitch';
import * as style from './buy.css';

interface BuyProps {
    accounts: Account[];
    code?: string;
    devices: Devices;
}

interface LoadedBuyProps {
    safello: { url: string, addressID: string; address: string; };
    balance: BalanceInterface;
    secureOutput: { hasSecureOutput: boolean; optional: boolean; };
}

interface Account {
    code: string;
    coinCode: string;
    coinUnit: string;
    name: string;
}

type Props = LoadedBuyProps & BuyProps & TranslateProps;

interface State {
    verifying: boolean;
}

class Buy extends Component<Props, State> {
    constructor(props) {
        super(props);
    }

    private getAccount = () => {
        if (!this.props.accounts) {
            return undefined;
        }
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    public componentWillMount() {
        this.registerEvents();
    }

    public componentWillUnmount() {
        this.unregisterEvents();
    }

    private verifyAddress = () => {
        const { safello, secureOutput } = this.props;
        if (!secureOutput.hasSecureOutput) {
            this.unregisterEvents();
            alertUser(this.props.t('receive.warning.secureOutput'), this.registerEvents);
            return;
        }
        this.setState({ verifying: true });
        apiPost('account/' + this.props.code + '/verify-address', safello.addressID).then(() => {
            this.setState({ verifying: false });
        });
    }

    private registerEvents = () => {
        document.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('message', e => {
            const data = e.data;
            if (typeof data !== 'object') {
                return;
            }
            if (!data.type) {
                return;
            }
            if (data.type !== 'ORDER_DONE' && data.type !== 'TRANSACTION_ISSUED') {
                return;
            }
            apiPost('account/' + this.props.code + '/exchange/safello/process-message', data);
        });
    }

    private unregisterEvents = () => {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.keyCode === 27) {
            route(`/account/${this.props.code}`);
        }
    }

    public render(
        { balance,
          code,
          safello,
          t }: RenderableProps<Props>,
        { verifying }: State,
    ) {
        const account = this.getAccount();
        if (!account) {
            return null;
        }
        const iframeLoadingImg = 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100% 100%"><text fill="%231D1D1B" x="50%" y="10%" font-size="24" text-anchor="middle">' + t('loading') + '</text></svg>';

        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('buy.title', { accountName: account.name })}</h2>} />
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            <div className="flex flex-row flex-between">
                                <label className="labelXLarge">{t('accountSummary.availableBalance')}</label>
                            </div>
                            <div className="box large">
                                <Balance balance={balance} />
                            </div>
                            <div className={style.container}>
                                {/* just to have a space after the above box */}
                            </div>
                            <div className="box large text-center m-bottom-default">
                                <label className="labelXLarge">Powered by Safello</label>
                                <Button
                                    primary
                                    className="m-bottom-half full-width-on-small"
                                    disabled={verifying}
                                    onClick={this.verifyAddress}>
                                    {t('receive.verify')}
                                </Button>
                                <br />
                                <iframe
                                    width="500"
                                    height="720"
                                    frameBorder="0"
                                    className={style.iframe}
                                    style={"background: url('" + iframeLoadingImg + "') 0px 0px no-repeat;"}
                                    src={safello.url}>
                                </iframe>

                                <div className="buttons ignore">
                                    <ButtonLink
                                        transparent
                                        className="full-width-on-small"
                                        href={`/account/${code}`}>
                                        {t('button.back')}
                                    </ButtonLink>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.buy.support" entry={t('guide.buy.support')} shown={true} />
                </Guide>
            </div>
        );
    }
}

const loadHOC = load<LoadedBuyProps, BuyProps & TranslateProps>(({ code }) => ({
    safello: `account/${code}/exchange/safello/buy`,
    balance: `account/${code}/balance`,
    secureOutput: `account/${code}/has-secure-output`,
}))(Buy);
const HOC = translate<BuyProps>()(loadHOC);
export { HOC as Buy };
