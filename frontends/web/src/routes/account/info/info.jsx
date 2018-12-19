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

import { Component, h } from 'preact';
import { ButtonLink } from '../../../components/forms';
import Balance from '../../../components/balance/balance';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { QRCode } from '../../../components/qrcode/qrcode';
import { apiGet } from '../../../utils/request';
import { Guide } from '../../../components/guide/guide';
import { Entry } from '../../../components/guide/entry';
import { Header } from '../../../components/header/Header';
import { CopyableInput } from '../../../components/copy/Copy';
import * as style from './info.css';

const SigningConfiguration = ({ t, signingConfiguration }) => {
    return (
        // TODO: add info if single or multisig, and threshold.
        <div>
            {
                signingConfiguration.xpubs.map((xpub, index) => {
                    return (
                        <div key={xpub}>
                            <strong>
                                {t('accountInfo.extendedPublicKey')}
                                {signingConfiguration.xpubs.length > 1 && (' #' + (index+1))}
                            </strong><br />
                            <QRCode data={xpub} />
                            <CopyableInput value={xpub} />
                        </div>
                    );
                })
            }
        </div>
    );
};

@translate()
export default class Info extends Component {
    constructor(props) {
        super(props);
        this.state = {
            balance: null,
            info: null
        };
    }

    componentDidMount() {
        apiGet(`account/${this.props.code}/balance`).then(balance => this.setState({ balance }));
        apiGet(`account/${this.props.code}/info`).then(info => this.setState({ info }));
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = e => {
        if (e.keyCode === 27) {
            console.log('receive.jsx route to /'); // eslint-disable-line no-console
            route(`/account/${this.props.code}`);
        }
    }

    getAccount() {
        if (!this.props.accounts) return null;
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    render({
        t,
        code,
    }, {
        balance,
        info
    }) {
        const account = this.getAccount();
        if (!account || !info) return null;
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('accountInfo.title')}</h2>} {...this.props}>
                        <Balance
                            t={t}
                            balance={balance} />
                    </Header>
                    <div class="innerContainer">
                        <div class="content padded flex flex-column flex-center">
                            <div class={style.infoContent}>
                                <SigningConfiguration
                                    t={t}
                                    signingConfiguration={info.signingConfiguration} />
                            </div>
                        </div>
                        <div class={style.bottomButtons}>
                            <ButtonLink
                                secondary
                                href={`/account/${code}`}>
                                {t('button.back')}
                            </ButtonLink>
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
