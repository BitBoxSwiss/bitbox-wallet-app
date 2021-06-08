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
import { ButtonLink } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import { Entry } from '../../../components/guide/entry';
import { Header } from '../../../components/layout';
import * as style from './info.css';
import { SigningConfiguration } from './signingconfiguration';

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

    private handleKeyDown = e => {
        if (e.keyCode === 27) {
            console.info('receive.jsx route to /');
            route(`/account/${this.props.code}`);
        }
    }

    private getAccount() {
        if (!this.props.accounts) return null;
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    private showNextXPub = () => {
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
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('accountInfo.title')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div class={`${style.infoContent} box larger`}>
                                <h2 className={style.title}>
                                    {t('accountInfo.extendedPublicKey')}
                                </h2>
                                { numberOfXPubs > 1 ? (
                                    <p className={style.xPubInfo}>
                                        {t(`accountInfo.xpubTypeInfo.${viewXPub}`, {
                                            current: `${viewXPub + 1}`,
                                            numberOfXPubs: numberOfXPubs.toString(),
                                        })}<br />
                                        <button class={style.nextButton} onClick={this.showNextXPub}>
                                            {t(`accountInfo.xpubTypeChangeBtn.${(viewXPub + 1) % numberOfXPubs}`)}
                                        </button>
                                    </p>
                                ) : null}
                                <SigningConfiguration
                                    key={viewXPub}
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
                <Guide>
                    <Entry key="guide.accountInfo.xpub" entry={t('guide.accountInfo.xpub')} />
                </Guide>
            </div>
        );
    }
}

const HOC = translate<InfoProps>()(Info);
export { HOC as Info };
