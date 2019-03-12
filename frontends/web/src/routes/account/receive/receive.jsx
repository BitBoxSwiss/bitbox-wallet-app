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
import { Button, ButtonLink } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import { Entry } from '../../../components/guide/entry';
import { alertUser } from '../../../components/alert/Alert';
import { Header } from '../../../components/layout';
import Status from '../../../components/status/status';
import { QRCode } from '../../../components/qrcode/qrcode';
import { CopyableInput } from '../../../components/copy/Copy';
import ArrowLeft from '../../../assets/icons/arrow-left-gray.svg';
import ArrowRight from '../../../assets/icons/arrow-right-gray.svg';
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

        /** @type {{ hasSecureOutput: boolean, optional: boolean } | undefined} */
        secureOutput: undefined,
        verified: false,
    }

    componentDidMount() {
        apiGet('account/' + this.props.code + '/has-secure-output').then(secureOutput => {
            this.setState({ secureOutput });
        });
        apiGet('account/' + this.props.code + '/receive-addresses').then(receiveAddresses => {
            this.setState({ receiveAddresses, activeIndex: 0 });
        });
        if (this.props.deviceIDs.length > 0) {
            apiGet('devices/' + this.props.deviceIDs[0] + '/has-mobile-channel').then(paired => {
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
        const { receiveAddresses, activeIndex, secureOutput } = this.state;
        if (secureOutput === undefined) {
            return;
        }
        if (!secureOutput.hasSecureOutput) {
            alertUser(this.props.t('receive.warning.secureOutput'), this.registerEvents);
            return;
        }
        if (receiveAddresses !== null && activeIndex !== null) {
            this.setState({ verifying: true });
            apiPost('account/' + this.props.code + '/verify-address', receiveAddresses[activeIndex].addressID).then(() => {
                this.setState({ verifying: false, verified: true });
            });
        }
    }

    previous = () => {
        this.setState(({ activeIndex, receiveAddresses }) => ({
            activeIndex: (activeIndex + receiveAddresses.length - 1) % receiveAddresses.length,
            verified: false,
        }));
    };

    next = () => {
        this.setState(({ activeIndex, receiveAddresses }) => ({
            activeIndex: (activeIndex + 1) % receiveAddresses.length,
            verified: false,
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

    getAccount() {
        if (!this.props.accounts) return undefined;
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    render({
        t,
        code,
    }, {
        verifying,
        verified,
        secureOutput,
        activeIndex,
        receiveAddresses,
        paired,
    }) {
        if (secureOutput === undefined) {
            return null;
        }
        const account = this.getAccount();
        if (account === undefined) {
            return null;
        }
        let uriPrefix = 'bitcoin:';
        if (account.coinCode === 'ltc' || account.coinCode === 'tltc') {
            uriPrefix = 'litecoin:';
        } else if (account.coinCode === 'eth' || account.coinCode === 'teth' || account.coinCode === 'reth') {
            uriPrefix = '';
        }
        // enable copying only after verification has been invoked if verification is possible and not optional.
        const forceVerification = secureOutput.hasSecureOutput && !secureOutput.optional;
        let enableCopy = !forceVerification || verified;
        let address;
        if (receiveAddresses) {
            address = receiveAddresses[activeIndex].address;
            if (!enableCopy && !verifying) {
                address = address.substring(0, 8) + '...';
            }
        }
        const content = receiveAddresses ? (
            <div>
                <div>
                    <QRCode data={enableCopy ? uriPrefix + address : undefined} />
                    <CopyableInput disabled={!enableCopy} value={address} />
                    { forceVerification ? (
                          verifying ? (
                              <div>Please verify the address on your device</div>
                          ) : (
                              <Button
                                  primary
                                  disabled={verifying || secureOutput === undefined}
                                  onClick={this.verifyAddress}>
                                  Show and verify full address
                              </Button>
                          )
                    ) : ''}
                </div>
                <div class={['flex flex-row flex-center flex-items-center', style.labels].join(' ')}>
                    {
                        receiveAddresses.length > 1 && (
                            <Button
                                transparent
                                disabled={verifying}
                                onClick={this.previous}>
                                <img src={ArrowLeft} class={style.arrowLeft} />
                                {t('button.previous')}
                            </Button>
                        )
                    }
                    <p class={style.label}>{t('receive.label')} { receiveAddresses.length > 1 ? `(${activeIndex + 1}/${receiveAddresses.length})` : ''}</p>
                    {
                        receiveAddresses.length > 1 && (
                            <Button
                                transparent
                                disabled={verifying}
                                onClick={this.next}
                                className={style.button}>
                                {t('button.next')}
                                <img src={ArrowRight} class={style.arrowRight} />
                            </Button>
                        )
                    }
                </div>
                {
                    code === 'ltc-p2wpkh-p2sh' && (
                        <div>
                            <p>{t('receive.ltcLegacy.info')}</p>
                            <Button
                                primary
                                onClick={this.ltcConvertToLegacy}
                                className={style.button}>
                                {t('receive.ltcLegacy.button')}
                            </Button>
                        </div>
                    )
                }
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
                    <Header title={<h2>{t('receive.title')}</h2>} />
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
                            { !forceVerification ? (
                                <Button
                                    primary
                                    disabled={verifying || secureOutput === undefined}
                                    onClick={this.verifyAddress}>
                                    {t('receive.verify')}
                                </Button>
                            ) : ''
                            }
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.receive.address" entry={t('guide.receive.address')} />
                    { receiveAddresses && receiveAddresses.length > 1 && <Entry key="guide.receive.whyMany" entry={t('guide.receive.whyMany')} /> }
                    <Entry key="guide.receive.whyVerify" entry={t('guide.receive.whyVerify')} />
                    <Entry key="guide.receive.howVerify" entry={t('guide.receive.howVerify')} />
                    { receiveAddresses && receiveAddresses.length > 1 && <Entry key="guide.receive.addressChange" entry={t('guide.receive.addressChange')} /> }
                </Guide>
            </div>
        );
    }
}
