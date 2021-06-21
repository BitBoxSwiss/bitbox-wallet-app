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

import { Component, h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import { translate, TranslateProps } from '../../../decorators/translate';
import { getInfo, IAccount, ISigningConfigurationList } from '../../../api/account';
import { isBitcoinBased } from '../utils';
import { ButtonLink } from '../../../components/forms';
import { Header } from '../../../components/layout';
import * as style from './info.css';
import { SigningConfiguration } from './signingconfiguration';
import { BitcoinBasedAccountInfoGuide } from './guide';

interface InfoProps {
    accounts: IAccount[];
    code: string;
}

interface State {
    info?: ISigningConfigurationList;
    viewXPub: number;
}

type Props = InfoProps & TranslateProps;

class Info extends Component<Props, State> {
    public readonly state: State = {
        info: undefined,
        viewXPub: 0,
    }

    public componentDidMount() {
        getInfo(this.props.code).then(info => this.setState({ info }));
    }

    public componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    public componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.keyCode === 27) {
            route(`/account/${this.props.code}`);
        }
    }

    private getAccount(): IAccount | undefined {
        if (!this.props.accounts) {
            return;
        }
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    private showNextXPub = (): void => {
        if (!this.state.info) {
            return;
        }
        const numberOfXPubs = this.state.info.signingConfigurations.length;
        this.setState(({ viewXPub }) => ({
            viewXPub: (viewXPub + 1) % numberOfXPubs
        }));
    }

    public render(
        { t, code }: RenderableProps<Props>,
        { info, viewXPub }: State
    ) {
        const account = this.getAccount();
        if (!account || !info) return null;
        const config = info.signingConfigurations[viewXPub];
        const numberOfXPubs = info.signingConfigurations.length;
        const xpubTypes = info.signingConfigurations.map(cfg => cfg.bitcoinSimple?.scriptType);

        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('accountInfo.title')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div class="box larger">
                                { isBitcoinBased(account.coinCode) ? (
                                    <h2 className={style.title}>
                                        {t('accountInfo.extendedPublicKey')}
                                    </h2>
                                ) : null }
                                { (config.bitcoinSimple !== undefined && numberOfXPubs > 1) ? (
                                    <p className={style.xPubInfo}>
                                        {t('accountInfo.xpubTypeInfo', {
                                            current: `${viewXPub + 1}`,
                                            numberOfXPubs: numberOfXPubs.toString(),
                                            scriptType: config.bitcoinSimple.scriptType.toUpperCase(),
                                        })}<br />
                                        <button class={style.nextButton} onClick={this.showNextXPub}>
                                            {t(`accountInfo.xpubTypeChangeBtn.${xpubTypes[(viewXPub + 1) % numberOfXPubs]}`)}
                                        </button>
                                    </p>
                                ) : null}
                                <SigningConfiguration
                                    key={viewXPub}
                                    account={account}
                                    code={code}
                                    info={config}
                                    signingConfigIndex={viewXPub}>
                                    <ButtonLink
                                        transparent
                                        href={`/account/${code}`}>
                                        {t('button.back')}
                                    </ButtonLink>
                                </SigningConfiguration>
                            </div>
                        </div>
                    </div>
                </div>
                { isBitcoinBased(account.coinCode) ? (
                    <BitcoinBasedAccountInfoGuide t={t} coinName={account.coinName} />
                ) : null }
            </div>
        );
    }
}

const HOC = translate<InfoProps>()(Info);
export { HOC as Info };
