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
import { CopyableInput } from '../../../components/copy/Copy';
import { Dialog } from '../../../components/dialog/dialog';
import { Button, ButtonLink } from '../../../components/forms';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { Header } from '../../../components/layout';
import { QRCode } from '../../../components/qrcode/qrcode';
import Status from '../../../components/status/status';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet, apiPost } from '../../../utils/request';
import { Devices } from '../../device/deviceswitch';
import { AccountInterface } from '../account';
import { isEthereumBased } from '../utils';
import * as style from './receive.css';

interface ReceiveProps {
    code?: string;
    devices: Devices;
    accounts: AccountInterface[];
    deviceIDs: string[];
}

interface State {
    verifying: boolean;
    activeIndex: number;
    receiveAddresses: Array<{ addressID: any, address: any }> | null;
    paired: boolean | null;
    secureOutput?: {
        hasSecureOutput: boolean;
        optional: boolean;
    };
}

type Props = ReceiveProps & TranslateProps;

class Receive extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            verifying: false,
            activeIndex: 0,
            receiveAddresses: null,
            paired: null,
            secureOutput: undefined,
        };
    }

    public componentDidMount() {
        apiGet('account/' + this.props.code + '/has-secure-output').then(secureOutput => {
            this.setState({ secureOutput });
        });
        apiGet('account/' + this.props.code + '/receive-addresses').then(receiveAddresses => {
            this.setState({ receiveAddresses, activeIndex: 0 });
        });
        if (this.getDevice() === 'bitbox') {
            apiGet('devices/' + this.props.deviceIDs[0] + '/has-mobile-channel').then(paired => {
                this.setState({ paired });
            });
        }
    }

    public componentWillMount() {
        this.registerEvents();
    }

    public componentWillUnmount() {
        this.unregisterEvents();
    }

    private registerEvents = () => {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    private unregisterEvents = () => {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.keyCode === 27) {
            if (!this.state.verifying) {
                route(`/account/${this.props.code}`);
            }
        }
    }

    private verifyAddress = () => {
        const { receiveAddresses, activeIndex } = this.state;
        const secureOutput = this.state.secureOutput;
        if (secureOutput === undefined) {
            return;
        }
        if (!secureOutput.hasSecureOutput) {
            this.unregisterEvents();
            alertUser(this.props.t('receive.warning.secureOutput'), this.registerEvents);
            return;
        }
        if (receiveAddresses !== null) {
            this.setState({ verifying: true });
            apiPost('account/' + this.props.code + '/verify-address', receiveAddresses[activeIndex].addressID).then(() => {
                this.setState({ verifying: false });
            });
        }
    }

    private previous = (e: Event) => {
        e.preventDefault();
        const activeIndex = this.state.activeIndex;
        if (!this.state.verifying && activeIndex > 0) {
            this.setState({
                activeIndex: activeIndex - 1,
            });
        }
    }

    private next = (e: Event) => {
        e.preventDefault();
        const { verifying, activeIndex, receiveAddresses } = this.state;
        if (!verifying && receiveAddresses !== null && activeIndex < receiveAddresses.length - 1) {
            this.setState({
                activeIndex: activeIndex + 1,
            });
        }
    }

    private getAccount = () => {
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    private getDevice = () => {
        if (this.props.deviceIDs.length === 0) {
            return undefined;
        }
        return this.props.devices[this.props.deviceIDs[0]];
    }

    public render(
        { t,
            code }: RenderableProps<Props>,
        { verifying,
            secureOutput,
            activeIndex,
            receiveAddresses,
            paired }: State,
    ) {
        if (secureOutput === undefined) {
            return null;
        }
        const account = this.getAccount();
        if (account === undefined) {
            return null;
        }
        let uriPrefix = '';
        if (account.coinCode === 'btc' || account.coinCode === 'tbtc') {
            uriPrefix = 'bitcoin:';
        } else if (account.coinCode === 'ltc' || account.coinCode === 'tltc') {
            uriPrefix = 'litecoin:';
        }
        // enable copying only after verification has been invoked if verification is possible and not optional.
        const forceVerification = secureOutput.hasSecureOutput && !secureOutput.optional;
        const enableCopy = !forceVerification;
        let address;
        if (receiveAddresses) {
            address = receiveAddresses[activeIndex].address;
            if (!enableCopy && !verifying) {
                address = address.substring(0, 8) + '...';
            }
        }
        let verifyLabel = t('receive.verify'); // fallback
        const device = this.getDevice();
        if (device === 'bitbox') {
            verifyLabel = t('receive.verifyBitBox01');
        } else if (device === 'bitbox02') {
            verifyLabel = t('receive.verifyBitBox02');
        }
        const content = receiveAddresses ? (
            <div style="position: relative;">
                <div class={style.qrCodeContainer}>
                    <QRCode data={enableCopy ? uriPrefix + address : undefined} />
                </div>
                <div class={['flex flex-row flex-between flex-items-center', style.labels].join(' ')}>
                    {
                        receiveAddresses.length > 1 && (
                            <a
                                href="#"
                                className={['flex flex-row flex-items-center', verifying || activeIndex === 0 ? style.disabled : '', style.previous].join(' ')}
                                onClick={this.previous}>
                                <svg
                                    className={[style.arrow, verifying ? style.disabled : ''].join(' ')}
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 8 8 12 12 16"></polyline>
                                    <line x1="16" y1="12" x2="8" y2="12"></line>
                                </svg>
                                {/* {t('button.previous')} */}
                            </a>
                        )
                    }
                    <p class={style.label}>{t('receive.label')} {receiveAddresses.length > 1 ? `(${activeIndex + 1}/${receiveAddresses.length})` : ''}</p>
                    {
                        receiveAddresses.length > 1 && (
                            <a
                                href="#"
                                className={['flex flex-row flex-items-center', verifying || activeIndex >= receiveAddresses.length - 1 ? style.disabled : '', style.next].join(' ')}
                                onClick={this.next}>
                                {/* {t('button.next')} */}
                                <svg
                                    className={[style.arrow, verifying ? style.disabled : ''].join(' ')}
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 16 16 12 12 8"></polyline>
                                    <line x1="8" y1="12" x2="16" y2="12"></line>
                                </svg>
                            </a>
                        )
                    }
                </div>
                <CopyableInput disabled={!enableCopy} value={address} flexibleHeight />
                <div className="buttons">
                    {
                        forceVerification && (
                            <Button
                                primary
                                disabled={verifying || secureOutput === undefined}
                                onClick={this.verifyAddress}>
                                {t('receive.showFull')}
                            </Button>
                        )
                    }
                    {
                        !forceVerification && (
                            <Button
                                primary
                                disabled={verifying || secureOutput === undefined}
                                onClick={this.verifyAddress}>
                                {verifyLabel}
                            </Button>
                        )
                    }
                    <ButtonLink
                        transparent
                        href={`/account/${code}`}>
                        {t('button.back')}
                    </ButtonLink>
                </div>
                {
                    forceVerification && verifying && (
                        <div className={style.hide}></div>
                    )
                }
                {
                    forceVerification && verifying && (
                        <Dialog
                            title={verifyLabel}
                            disableEscape={true}
                            medium centered>
                            <div className="text-center">
                                {
                                    isEthereumBased(account.coinCode) &&
                                    <p>
                                        <strong>
                                            {t('receive.onlyThisCoin.warning', { accountName: account.name.replace(' BETA', '') })}
                                        </strong><br />
                                        {t('receive.onlyThisCoin.description')}
                                    </p>
                                }
                                <QRCode data={uriPrefix + address} />
                                <p>{t('receive.verifyInstruction')}</p>
                            </div>
                            <div className="m-bottom-half">
                                <CopyableInput value={address} />
                            </div>
                        </Dialog>
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
                    <Header title={<h2>{t('receive.title', { accountName: account.name })}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content narrow isVerticallyCentered">
                            <div class="box large text-center">
                                {content}
                            </div>
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.receive.address" entry={t('guide.receive.address')} />
                    <Entry key="guide.receive.whyVerify" entry={t('guide.receive.whyVerify')} />
                    <Entry key="guide.receive.howVerify" entry={t('guide.receive.howVerify')} />
                    {receiveAddresses && receiveAddresses.length > 1 && <Entry key="guide.receive.whyMany" entry={t('guide.receive.whyMany')} />}
                    {receiveAddresses && receiveAddresses.length > 1 && <Entry key="guide.receive.why20" entry={t('guide.receive.why20')} />}
                    {receiveAddresses && receiveAddresses.length > 1 && <Entry key="guide.receive.addressChange" entry={t('guide.receive.addressChange')} />}
                </Guide>
            </div>
        );
    }
}

const HOC = translate<ReceiveProps>()(Receive);
export { HOC as Receive };
