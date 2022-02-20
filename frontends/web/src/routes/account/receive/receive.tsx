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

import React, { Component} from 'react';
import { route } from '../../../utils/route';
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
import { apiGet } from '../../../utils/request';
import { isEthereumBased } from '../utils';
import style from './receive.module.css';
import { ArrowCirlceLeft, ArrowCirlceLeftActive, ArrowCirlceRight, ArrowCirlceRightActive } from '../../../components/icon';

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
    // index into `availableScriptTypes`, or 0 if none are available.
    addressType: number;
}

interface LoadedReceiveProps {
    // first array index: address types. second array index: unused addresses of that address type.
    receiveAddresses: accountApi.ReceiveAddressList[];
    secureOutput: {
        hasSecureOutput: boolean;
        optional: boolean;
    };
}

type Props = LoadedReceiveProps & ReceiveProps & TranslateProps;

// For BTC/LTC: all possible address types we want to offer to the user, ordered by priority (first one is default).
// Types that are not available in the addresses delivered by the backend should be ignored.
const scriptTypes: accountApi.ScriptType[] = ['p2wpkh', 'p2tr', 'p2wpkh-p2sh']

class Receive extends Component<Props, State> {
    // Find index in list of receive addresses that matches the given script type, or -1 if not found.
    private getIndexOfMatchingScriptType = (scriptType: accountApi.ScriptType): number => {
        return this.props.receiveAddresses.findIndex(addrs => addrs.scriptType !== null && scriptType === addrs.scriptType);
    }

    // All script types that are present in the addresses delivered by the backend. Will be empty for if there are no such addresses, e.g. in Ethereum.
    private availableScriptTypes: accountApi.ScriptType[] = scriptTypes.filter(sc => this.getIndexOfMatchingScriptType(sc) >= 0);
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

    public UNSAFE_componentWillMount() {
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
        const { receiveAddresses, secureOutput, code } = this.props;
        if (code === undefined) {
            return;
        }
        const { activeIndex } = this.state;
        if (!secureOutput.hasSecureOutput) {
            this.unregisterEvents();
            alertUser(this.props.t('receive.warning.secureOutput'), this.registerEvents);
            return;
        }
        this.setState({ verifying: true });
        accountApi.verifyAddress(
            code,
            receiveAddresses[addressesIndex].addresses[activeIndex].addressID).then(() => {
                this.setState({ verifying: false });
            });
    }

    private previous = (e: React.SyntheticEvent) => {
        e.preventDefault();
        const activeIndex = this.state.activeIndex;
        if (!this.state.verifying && activeIndex > 0) {
            this.setState({
                activeIndex: activeIndex - 1,
            });
        }
    }

    private next = (e: React.SyntheticEvent, numAddresses: number) => {
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

    private nextAddressType = () => {
        this.setState(({ addressType }) => ({
            activeIndex: 0,
            addressType: this.getNextAddressTypeIndex(addressType)
        }));
    }

    private getNextAddressTypeIndex = (currentAddressType: number) => {
        return (currentAddressType + 1) % this.availableScriptTypes.length;
    }

    public render() {
        const {
             t,
            code,
            receiveAddresses,
            secureOutput
        } = this.props;
        const {
            verifying,
            activeIndex,
            paired,
            addressType
        } = this.state;
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

        let currentAddressIndex = this.availableScriptTypes.length > 0 ? this.getIndexOfMatchingScriptType(this.availableScriptTypes[addressType]) : 0;
        if (currentAddressIndex === -1) {
            currentAddressIndex = 0;
        }
        const currentAddresses = receiveAddresses[currentAddressIndex].addresses;

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
            <div style={{position: 'relative'}}>
                <div className={style.qrCodeContainer}>
                    <QRCode data={enableCopy ? uriPrefix + address : undefined} />
                </div>
                <div className={style.labels}>
                    {
                        currentAddresses.length > 1 && (
                            <button
                                className={style.previous}
                                onClick={this.previous}>
                                {(verifying || activeIndex === 0) ? (
                                    <ArrowCirlceLeft height="24" width="24" />
                                ) : (
                                    <ArrowCirlceLeftActive height="24" width="24" title={t('button.previous')} />
                                )}
                            </button>
                        )
                    }
                    <p className={style.label}>{t('receive.label')} {currentAddresses.length > 1 ? `(${activeIndex + 1}/${currentAddresses.length})` : ''}</p>
                    {
                        currentAddresses.length > 1 && (
                            <button
                                className={style.next}
                                onClick={e => this.next(e, currentAddresses.length)}>
                                {(verifying || activeIndex >= currentAddresses.length - 1) ? (
                                    <ArrowCirlceRight height="24" width="24" />
                                ) : (
                                    <ArrowCirlceRightActive height="24" width="24" title={t('button.next')} />
                                )}
                            </button>
                        )
                    }
                </div>
                <CopyableInput disabled={!enableCopy} value={address} flexibleHeight />
                { this.availableScriptTypes.length > 1 && (
                    <button className={style.changeType} onClick={this.nextAddressType}>
                        {t(`receive.scriptType.${this.availableScriptTypes[this.getNextAddressTypeIndex(addressType)]}`)}
                    </button>
                )}
                <div className="buttons">
                    {
                        forceVerification && (
                            <Button
                                primary
                                disabled={verifying || secureOutput === undefined}
                                onClick={() => this.verifyAddress(currentAddressIndex)}>
                                {t('receive.showFull')}
                            </Button>
                        )
                    }
                    {
                        !forceVerification && (
                            <Button
                                primary
                                disabled={verifying || secureOutput === undefined}
                                onClick={() => this.verifyAddress(currentAddressIndex)}>
                                {verifyLabel}
                            </Button>
                        )
                    }
                    <ButtonLink
                        transparent
                        to={`/account/${code}`}>
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
                                            {t('receive.onlyThisCoin.warning', {
                                                coinName: account.coinName,
                                            })}
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
            <div className="contentWithGuide">
                <div className="container">
                    <Status type="warning" hidden={paired !== false}>
                        {t('warning.receivePairing')}
                    </Status>
                    <Header title={<h2>{t('receive.title', { accountName: account.coinName })}</h2>} />
                    <div className="innerContainer scrollableContainer">
                        <div className="content narrow isVerticallyCentered">
                            <div className="box large text-center">
                                {content}
                            </div>
                        </div>
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.receive.address" entry={t('guide.receive.address')} />
                    <Entry key="guide.receive.whyVerify" entry={t('guide.receive.whyVerify')} />
                    <Entry key="guide.receive.howVerify" entry={t('guide.receive.howVerify')} />
                    <Entry key="guide.receive.plugout" entry={t('guide.receive.plugout')} />
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
const HOC = translate()(loadHOC);
export { HOC as Receive };
