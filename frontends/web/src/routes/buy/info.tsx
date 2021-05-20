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

import { Component, h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import { CoinCode, IAccount } from '../../api/account';
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
import { isBitcoin } from '../account/utils';
import * as style from './info.css';

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
    value: CoinCode;
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

    private handleSkipDisclaimer = (e) => {
        setConfig({ frontend: { skipBuyDisclaimer: e.target.checked }});
    }

    public render(
        { code,
          t }: RenderableProps<Props>,
        {
            status,
            selected,
            options,
        }: State
    ) {
        if (options === undefined) {
            return <Spinner text={t('loading')} />;
        }
        const name = (code && isBitcoin(code)) ? 'Bitcoin' : 'crypto';
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('buy.info.title', { name })}</h2>} />
                    <div class="innerContainer">
                        { status === 'agree' ? (
                            <div class={style.disclaimerContainer}>
                                <div class={style.disclaimer}>
                                    <h2 class={style.title}>
                                        {t('buy.info.disclaimer.title', { name })}
                                    </h2>
                                    <p>{t('buy.info.disclaimer.intro.0', { name })}</p>
                                    <p>{t('buy.info.disclaimer.intro.1', { name })}</p>
                                    <h2 class={style.title}>
                                        {t('buy.info.disclaimer.payment.title')}
                                    </h2>
                                    <p>{t('buy.info.disclaimer.payment.details', { name })}</p>
                                    <div class={style.table}>
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
                                                    <td class={style.nowrap}>1.9 %</td>
                                                    <td>{t('buy.info.disclaimer.payment.table.1_description')}</td>
                                                </tr>
                                                <tr>
                                                    <td>{t('buy.info.disclaimer.payment.table.2_method')}</td>
                                                    <td class={style.nowrap}>4.9 %</td>
                                                    <td>{t('buy.info.disclaimer.payment.table.2_description')}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <p>{t('buy.info.disclaimer.payment.footnote')}</p>
                                    <h2 class={style.title}>
                                        {t('buy.info.disclaimer.security.title')}
                                    </h2>
                                    <p>{t('buy.info.disclaimer.security.description', { name })}</p>
                                    <p>
                                        <A class={style.link} href="https://shiftcrypto.ch/bitbox02/threat-model/">
                                            {t('buy.info.disclaimer.security.link')}
                                        </A>
                                    </p>
                                    <h2 class={style.title}>
                                        {t('buy.info.disclaimer.protection.title')}
                                    </h2>
                                    <p>{t('buy.info.disclaimer.protection.description', { name })}</p>
                                    <p>
                                        <A class={style.link} href="https://www.moonpay.com/privacy_policy">
                                            {t('buy.info.disclaimer.privacyPolicy')}
                                        </A>
                                    </p>
                                </div>
                                <div class="text-center m-bottom-quarter">
                                    <Checkbox
                                        id="skip_disclaimer"
                                        label={t('buy.info.skip')}
                                        onChange={this.handleSkipDisclaimer} />
                                </div>
                                <div class="buttons text-center m-bottom-xlarge">
                                    <Button
                                        primary
                                        onClick={this.handleProceed}>
                                        {t('buy.info.continue')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            options.length === 0 ? (
                                <div class="content narrow isVerticallyCentered">{t('accountSummary.noAccount')}</div>
                            ) : (
                                <div class="content narrow isVerticallyCentered">
                                    <h1 class={style.title}>{t('buy.title', { name })}</h1>
                                    <Select
                                        options={[{
                                                text: t('buy.info.selectPlaceholder'),
                                                disabled: true,
                                                value: 'choose',
                                            },
                                            ...options]
                                        }
                                        onChange={e => this.setState({ selected: e.target.value})}
                                        value={selected}
                                        defaultValue={'choose'}
                                        id="coinAndAccountCode"
                                    />
                                    <div class="buttons text-center m-bottom-xxlarge">
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

const HOC = translate<BuyInfoProps>()(loadHOC);
export { HOC as BuyInfo };
