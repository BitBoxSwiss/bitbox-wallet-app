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
import * as accountApi from '../../../api/account';
import { TDevices } from '../../../api/devices';
import { alertUser } from '../../../components/alert/Alert';
import { CopyableInput } from '../../../components/copy/Copy';
import { Dialog } from '../../../components/dialog/dialog';
import { Button, ButtonLink } from '../../../components/forms';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { Header } from '../../../components/layout';
import { QRCode } from '../../../components/qrcode/qrcode';
import Status from '../../../components/status/status';
import { load } from '../../../decorators/load';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet, apiPost } from '../../../utils/request';
import { isEthereumBased } from '../utils';
import * as style from './receive.css';

interface ReceiveProps {
    code?: string;
    devices: TDevices;
    accounts: accountApi.IAccount[];
    deviceIDs: string[];
}

interface State {
    verifying: boolean;
    activeIndex: number;
    paired: boolean | null;
    addressType: number;
}

interface LoadedReceiveProps {
    // first array index: address types. second array index: unused addresses of that address type.
    receiveAddresses: accountApi.ReceiveAddressList;
    secureOutput: {
        hasSecureOutput: boolean;
        optional: boolean;
    };
}

type Props = LoadedReceiveProps & ReceiveProps & TranslateProps;

class Receive extends Component<Props, State> {
    public readonly state: State = {
        verifying: false,
        activeIndex: 0,
        paired: null,
        addressType: 0,
    }

    public componentDidMount() {
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

    private verifyAddress = (addressesIndex: number) => {
        const { receiveAddresses, secureOutput } = this.props;
        const { activeIndex } = this.state;
        if (!secureOutput.hasSecureOutput) {
            this.unregisterEvents();
            alertUser(this.props.t('receive.warning.secureOutput'), this.registerEvents);
            return;
        }
        this.setState({ verifying: true });
        apiPost('account/' + this.props.code + '/verify-address', receiveAddresses[addressesIndex][activeIndex].addressID).then(() => {
            this.setState({ verifying: false });
        });
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

    private next = (e: Event, numAddresses: number) => {
        e.preventDefault();
        const { verifying, activeIndex } = this.state;
        if (!verifying && activeIndex < numAddresses - 1) {
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

    private toggleAddressType = () => {
        this.setState(({ addressType }) => ({
            addressType: addressType ? 0 : 1,
        }));
    }

    public render(
        { t,
          code,
          receiveAddresses,
          secureOutput }: RenderableProps<Props>,
        { verifying,
          activeIndex,
          paired,
          addressType }: State,
    ) {
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

        const currentAddresses = receiveAddresses[addressType];

        let address = currentAddresses[activeIndex].address;
        if (!enableCopy && !verifying) {
            address = address.substring(0, 8) + '...';
        }

        let verifyLabel = t('receive.verify'); // fallback
        const device = this.getDevice();
        if (device === 'bitbox') {
            verifyLabel = t('receive.verifyBitBox01');
        } else if (device === 'bitbox02') {
            verifyLabel = t('receive.verifyBitBox02');
        }
        const content = (
            <div style="position: relative;">
                <div class={style.qrCodeContainer}>
                    <QRCode data={enableCopy ? uriPrefix + address : undefined} />
                </div>
                <div class={['flex flex-row flex-between flex-items-center', style.labels].join(' ')}>
                    {
                        currentAddresses.length > 1 && (
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
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 8 8 12 12 16"></polyline>
                                    <line x1="16" y1="12" x2="8" y2="12"></line>
                                </svg>
                                {/* {t('button.previous')} */}
                            </a>
                        )
                    }
                    <p class={style.label}>{t('receive.label')} {currentAddresses.length > 1 ? `(${activeIndex + 1}/${currentAddresses.length})` : ''}</p>
                    {
                        currentAddresses.length > 1 && (
                            <a
                                href="#"
                                className={['flex flex-row flex-items-center', verifying || activeIndex >= currentAddresses.length - 1 ? style.disabled : '', style.next].join(' ')}
                                onClick={e => this.next(e, currentAddresses.length)}>
                                {/* {t('button.next')} */}
                                <svg
                                    className={[style.arrow, verifying ? style.disabled : ''].join(' ')}
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 16 16 12 12 8"></polyline>
                                    <line x1="8" y1="12" x2="16" y2="12"></line>
                                </svg>
                            </a>
                        )
                    }
                </div>
                <CopyableInput disabled={!enableCopy} value={address} flexibleHeight />
                { receiveAddresses.length > 1 && (
                    <p className={style.changeType} onClick={this.toggleAddressType}>
                        {t(`receive.addressType.${this.state.addressType}`)}
                    </p>
                )}
                <div className="buttons">
                    {
                        forceVerification && (
                            <Button
                                primary
                                disabled={verifying || secureOutput === undefined}
                                onClick={() => this.verifyAddress(addressType)}>
                                {t('receive.showFull')}
                            </Button>
                        )
                    }
                    {
                        !forceVerification && (
                            <Button
                                primary
                                disabled={verifying || secureOutput === undefined}
                                onClick={() => this.verifyAddress(addressType)}>
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
                                            {t('receive.onlyThisCoin.warning', { accountName: account.name })}
                                        </strong><br />
                                        {t('receive.onlyThisCoin.description')}
                                    </p>
                                }
                                <QRCode data={uriPrefix + address} />
                                <p>{t('receive.verifyInstruction')}</p>
                            </div>
                            <div className="m-bottom-half">
                                <CopyableInput value={address} flexibleHeight />
                            </div>
                        </Dialog>
                    )
                }
            </div>
        );

        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Status type="warning" hidden={paired !== false}>
                        {t('warning.receivePairing')}
                    </Status>
                    <Header title={<h2>{t('receive.title', { accountName: account.coinName })}</h2>} />
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
                    {currentAddresses.length > 1 && <Entry key="guide.receive.whyMany" entry={t('guide.receive.whyMany')} />}
                    {currentAddresses.length > 1 && <Entry key="guide.receive.why20" entry={t('guide.receive.why20')} />}
                    {currentAddresses.length > 1 && <Entry key="guide.receive.addressChange" entry={t('guide.receive.addressChange')} />}
                    {receiveAddresses.length > 1 && currentAddresses.length > 1 && <Entry key="guide.receive.addressFormats" entry={t('guide.receive.addressFormats')} />}
                </Guide>
            </div>
        );
    }
}

const loadHOC = load<LoadedReceiveProps, ReceiveProps & TranslateProps>(({ code }) => ({
    secureOutput: `account/${code}/has-secure-output`,
    receiveAddresses: `account/${code}/receive-addresses`,
}))(Receive);
const HOC = translate<ReceiveProps>()(loadHOC);
export { HOC as Receive };
