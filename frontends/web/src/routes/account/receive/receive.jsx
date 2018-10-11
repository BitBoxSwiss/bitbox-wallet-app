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
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../../utils/request';
import { Button, ButtonLink, Input } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import { alertUser } from '../../../components/alert/Alert';
import Header from '../../../components/header/Header';
import Status from '../../../components/status/status';
import QRCode from '../../../components/qrcode/qrcode';
import * as style from './receive.css';

@translate()
export default class Receive extends Component {
    state = {
        verifying: false,

        /** @type {number | null} */
        activeIndex: null,

        /** @type {{ addressID: any, address: any }[] | null} */
        receiveAddresses: null,
        paired: null,
    }

    componentDidMount() {
        apiGet('account/' + this.props.code + '/receive-addresses').then(receiveAddresses => {
            this.setState({ receiveAddresses, activeIndex: 0 });
        });
        if (this.props.deviceIDs.length > 0) {
            apiGet('devices/' + this.props.deviceIDs[0] + '/paired').then((paired) => {
                this.setState({ paired });
            });
        }
    }

    componentWillMount() {
        this.registerEvents();
    }

    componentWillUnmount() {
        this.unregisterEvents();
    }

    registerEvents = () => {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    unregisterEvents = () => {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = e => {
        if (e.keyCode === 27) {
            console.log('receive.jsx route to /'); // eslint-disable-line no-console
            route(`/account/${this.props.code}`);
        }
    }

    verifyAddress = () => {
        const { receiveAddresses, activeIndex } = this.state;
        if (receiveAddresses !== null && activeIndex !== null) {
            this.setState({ verifying: true });
            apiPost('account/' + this.props.code + '/verify-address', receiveAddresses[activeIndex].addressID).then(hasSecureOutput => {
                this.setState({ verifying: false });
                if (!hasSecureOutput) {
                    this.unregisterEvents();
                    alertUser(this.props.t('receive.warning.secureOutput'), this.registerEvents);
                }
            });
        }
    }

    previous = () => {
        this.setState(({ activeIndex, receiveAddresses }) => ({
            activeIndex: (activeIndex + receiveAddresses.length - 1) % receiveAddresses.length
        }));
    };

    next = () => {
        this.setState(({ activeIndex, receiveAddresses }) => ({
            activeIndex: (activeIndex + 1) % receiveAddresses.length
        }));
    };

    ltcConvertToLegacy = () => {
        const { receiveAddresses, activeIndex } = this.state;
        if (receiveAddresses !== null && activeIndex !== null) {
            apiPost('account/' + this.props.code + '/convert-to-legacy-address',
                receiveAddresses[activeIndex].addressID)
                .then(legacyAddress => {
                    const address = receiveAddresses[activeIndex].address;
                    this.unregisterEvents();
                    alertUser(this.props.t('receive.ltcLegacy.result', {
                        address, legacyAddress
                    }), this.registerEvents);
                });
        }
    }

    render({
        t,
        coinCode,
        code,
    }, {
        verifying,
        activeIndex,
        receiveAddresses,
        paired,
    }) {
        let uriPrefix = 'bitcoin:';
        if (coinCode === 'ltc' || coinCode === 'tltc') {
            uriPrefix = 'litecoin:';
        }
        const content = receiveAddresses ? (
            <div>
                <QRCode data={uriPrefix + receiveAddresses[activeIndex].address} />
                <Input
                    readOnly
                    className={style.addressField}
                    onFocus={focus}
                    value={receiveAddresses[activeIndex].address} />
                <p class="label">
                    <Button
                        transparent
                        disabled={verifying}
                        onClick={this.previous}>
                        {t('button.previous')}
                    </Button>
                    {t('receive.label')}
                    {' '}
                    ({activeIndex + 1}/{receiveAddresses.length})
                    <Button
                        transparent
                        disabled={verifying}
                        onClick={this.next}
                        className={style.button}>
                        {t('button.next')}
                    </Button>
                </p>
                { code === 'ltc-p2wpkh-p2sh' && (
                    <div>
                        <p>{t('receive.ltcLegacy.info')}</p>
                        <Button
                            primary
                            onClick={this.ltcConvertToLegacy}
                            className={style.button}>
                            {t('receive.ltcLegacy.button')}
                        </Button>
                    </div>
                ) }
            </div>
        ) : (
            t('loading')
        );

        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Status type="warning">
                        {paired === false && t('warning.receivePairing')}
                    </Status>
                    <Header title={<h2>{t('receive.title')}</h2>} {...this.props} />
                    <div class="innerContainer">
                        <div class="content isVerticallyCentered">
                            <div class={style.receiveContent}>
                                {content}
                            </div>
                        </div>
                        <div class={style.bottomButtons}>
                            <ButtonLink
                                secondary
                                href={`/account/${code}`}>
                                {t('button.back')}
                            </ButtonLink>
                            <Button
                                primary
                                disabled={verifying}
                                onClick={this.verifyAddress}>
                                {t('receive.verify')}
                            </Button>
                        </div>
                    </div>
                </div>
                <Guide screen="receive" />
            </div>
        );
    }
}

function focus(e) {
    e.target.select();
}
