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

import React, { Component, createRef} from 'react';
import { BrowserQRCodeReader } from '@zxing/library';
import * as accountApi from '../../../api/account';
import { TDevices } from '../../../api/devices';
import { Checked, Cancel } from '../../../components/icon/icon';
import qrcodeIcon from '../../../assets/icons/qrcode.png';
import { alertUser } from '../../../components/alert/Alert';
import A from '../../../components/anchor/anchor';
import { Balance } from '../../../components/balance/balance';
import { Dialog } from '../../../components/dialog/dialog';
import { Button, ButtonLink, Checkbox, Input } from '../../../components/forms';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { Header } from '../../../components/layout';
import { store as fiat } from '../../../components/rates/rates';
import { Spinner } from '../../../components/spinner/Spinner';
import Status from '../../../components/status/status';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';
import { translate, TranslateProps } from '../../../decorators/translate';
import { debug } from '../../../utils/env';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { isBitcoinBased, customFeeUnit, isBitcoinOnly } from '../utils';
import { FeeTargets } from './feetargets';
import style from './send.module.css';
import { SelectedUTXO, UTXOs, UTXOsClass } from './utxos';
import { route } from '../../../utils/route';

interface SendProps {
    accounts: accountApi.IAccount[];
    code?: string;
    devices: TDevices;
    deviceIDs: string[];
}

interface SignProgress {
    steps: number;
    step: number;
}

type Props = SendProps & TranslateProps;

interface State {
    account?: accountApi.IAccount;
    balance?: accountApi.IBalance;
    proposedFee?: accountApi.IAmount;
    proposedTotal?: accountApi.IAmount;
    recipientAddress: string;
    proposedAmount?: accountApi.IAmount;
    valid: boolean;
    amount: string;
    fiatAmount: string;
    fiatUnit: accountApi.Fiat;
    sendAll: boolean;
    feeTarget?: accountApi.FeeTargetCode;
    customFee: string;
    isConfirming: boolean;
    isSent: boolean;
    isAborted: boolean;
    isUpdatingProposal: boolean;
    addressError?: string;
    amountError?: string;
    feeError?: string;
    paired?: boolean;
    noMobileChannelError?: boolean;
    signProgress?: SignProgress;
    // show visual BitBox in dialog when instructed to sign.
    signConfirm: boolean;
    coinControl: boolean;
    activeCoinControl: boolean;
    hasCamera: boolean;
    activeScanQR: boolean;
    videoLoading: boolean;
    note: string;
}

class Send extends Component<Props, State> {
    private utxos = createRef<UTXOsClass>();
    private selectedUTXOs: SelectedUTXO = {};
    private unsubscribe!: () => void;
    private qrCodeReader?: BrowserQRCodeReader;

    // pendingProposals keeps all requests that have been made
    // to /tx-proposal in case there are multiple parallel requests
    // we can ignore all other but the last one
    private pendingProposals: any = [];
    private proposeTimeout: any = null;

    public readonly state: State = {
        recipientAddress: '',
        amount: '',
        fiatAmount: '',
        valid: false,
        sendAll: false,
        isConfirming: false,
        signConfirm: false,
        isSent: false,
        isAborted: false,
        isUpdatingProposal: false,
        noMobileChannelError: false,
        fiatUnit: fiat.state.active,
        coinControl: false,
        activeCoinControl: false,
        hasCamera: false,
        activeScanQR: false,
        videoLoading: false,
        note: '',
        customFee: '',
    };

    private isBitcoinBased = () => {
        const account = this.getAccount();
        if (!account) {
            return false;
        }
        return isBitcoinBased(account.coinCode);
    }

    public componentDidMount() {
        if (this.props.code) {
            accountApi.getBalance(this.props.code)
                .then(balance => this.setState({ balance }))
                .catch(console.error);
        }
        if (this.props.deviceIDs.length > 0 && this.props.devices[this.props.deviceIDs[0]] === 'bitbox') {
            apiGet('devices/' + this.props.deviceIDs[0] + '/has-mobile-channel').then((mobileChannel: boolean) => {
                apiGet('devices/' + this.props.deviceIDs[0] + '/info').then(({ pairing }) => {
                    const account = this.getAccount();
                    const paired = mobileChannel && pairing;
                    const noMobileChannelError = pairing && !mobileChannel && account && isBitcoinBased(account.coinCode);
                    this.setState(prevState => ({ ...prevState, paired, noMobileChannelError }));
                });
            });
        }
        if (this.isBitcoinBased()) {
            apiGet('config').then(config => this.setState({ coinControl: !!(config.frontend || {}).coinControl }));
        }
        this.unsubscribe = apiWebsocket(({ type, data, meta }) => {
            switch (type) {
                case 'device':
                    switch (data) {
                        case 'signProgress':
                            this.setState({ signProgress: meta, signConfirm: false });
                            break;
                        case 'signConfirm':
                            this.setState({ signConfirm: true });
                            break;
                    }
                    break;
            }
        });
    }

    public UNSAFE_componentWillMount() {
        this.registerEvents();
        import('../../../components/qrcode/qrreader')
            .then(({ BrowserQRCodeReader }) => {
                if (!this.qrCodeReader) {
                    this.qrCodeReader = new BrowserQRCodeReader();
                }
                this.qrCodeReader
                    .getVideoInputDevices()
                    .then(videoInputDevices => {
                        this.setState({ hasCamera: videoInputDevices.length > 0 });
                    });
            })
            .catch(console.error);
    }

    public componentWillUnmount() {
        this.unregisterEvents();
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.qrCodeReader) {
            this.qrCodeReader.reset();
        }
    }

    private registerEvents = () => {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    private unregisterEvents = () => {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.keyCode === 27) {
            if (this.state.activeScanQR) {
                this.toggleScanQR();
            } else {
                route(`/account/${this.props.code}`);
            }
        }
    }

    private send = () => {
        if (this.state.noMobileChannelError) {
            alertUser(this.props.t('warning.sendPairing'));
            return;
        }
        this.setState({ signProgress: undefined, isConfirming: true });
        accountApi.sendTx(this.getAccount()!.code).then(result => {
            if (result.success) {
                this.setState({
                    sendAll: false,
                    isConfirming: false,
                    isSent: true,
                    recipientAddress: '',
                    proposedAmount: undefined,
                    proposedFee: undefined,
                    proposedTotal: undefined,
                    fiatAmount: '',
                    amount: '',
                    note: '',
                    customFee: '',
                });
                if (this.utxos.current) {
                    this.utxos.current.clear();
                }
                setTimeout(() => this.setState({
                    isSent: false,
                    isConfirming: false,
                }), 5000);
            } else if (result.aborted) {
                this.setState({ isAborted: true });
                setTimeout(() => this.setState({ isAborted: false }), 5000);
            } else {
                const { errorMessage } = result;
                alertUser(this.props.t('unknownError', errorMessage && { errorMessage }));
            }
        })
        .catch((error) => console.error(error))
        .then(() => {
            // The following method allows pressing escape again.
            this.setState({ isConfirming: false, signProgress: undefined, signConfirm: false });
        });
    }

    private txInput = () => ({
        address: this.state.recipientAddress,
        amount: this.state.amount,
        feeTarget: this.state.feeTarget || '',
        customFee: this.state.customFee,
        sendAll: this.state.sendAll ? 'yes' : 'no',
        selectedUTXOs: Object.keys(this.selectedUTXOs),
    })

    private sendDisabled = () => {
        const txInput = this.txInput();
        return !txInput.address || this.state.feeTarget === undefined || (txInput.sendAll === 'no' && !txInput.amount) || (this.state.feeTarget === 'custom' && !this.state.customFee);
    }

    private validateAndDisplayFee = (updateFiat: boolean = true) => {
        this.setState({
            proposedTotal: undefined,
            addressError: undefined,
            amountError: undefined,
            feeError: undefined,
        });
        if (this.sendDisabled()) {
            return;
        }
        const txInput = this.txInput();
        if (this.proposeTimeout) {
            clearTimeout(this.proposeTimeout);
            this.proposeTimeout = null;
        }
        this.setState({ isUpdatingProposal: true });
        this.proposeTimeout = setTimeout(() => {
            const propose = apiPost('account/' + this.getAccount()!.code + '/tx-proposal', txInput)
            .then(result => {
                const pos = this.pendingProposals.indexOf(propose);
                if (this.pendingProposals.length - 1 === pos) {
                    this.txProposal(updateFiat, result);
                }
                this.pendingProposals.splice(pos, 1);
            })
            .catch(() => {
                this.setState({ valid: false });
                this.pendingProposals.splice(this.pendingProposals.indexOf(propose), 1);
            });
            this.pendingProposals.push(propose);
        }, 400);
    }

    private handleNoteInput = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        this.setState({
            'note': target.value,
        }, () => {
            apiPost('account/' + this.getAccount()!.code + '/propose-tx-note', this.state.note);
        });
    }

    private txProposal = (updateFiat: boolean, result: {
        errorCode?: string;
        amount: accountApi.IAmount;
        fee: accountApi.IAmount;
        success: boolean;
        total: accountApi.IAmount;
    }) => {
        this.setState({ valid: result.success });
        if (result.success) {
            this.setState({
                addressError: undefined,
                amountError: undefined,
                feeError: undefined,
                proposedFee: result.fee,
                proposedAmount: result.amount,
                proposedTotal: result.total,
                isUpdatingProposal: false,
            });
            if (updateFiat) {
                this.convertToFiat(result.amount.amount);
            }
        } else {
            const errorCode = result.errorCode;
            switch (errorCode) {
                case 'invalidAddress':
                    this.setState({ addressError: this.props.t('send.error.invalidAddress') });
                    break;
                case 'invalidAmount':
                case 'insufficientFunds':
                    this.setState({
                        amountError: this.props.t(`send.error.${errorCode}`),
                        proposedFee: undefined,
                    });
                    break;
                case 'feeTooLow':
                    this.setState({ feeError: this.props.t('send.error.feeTooLow') });
                    break;
                case 'feesNotAvailable':
                    this.setState({ feeError: this.props.t('send.error.feesNotAvailable') });
                    break;
                default:
                    this.setState({ proposedFee: undefined });
                    if (errorCode) {
                        this.unregisterEvents();
                        alertUser(errorCode, { callback: this.registerEvents });
                    }
            }
            this.setState({ isUpdatingProposal: false });
        }
    }

    private handleFormChange = (event: React.SyntheticEvent) => {
        const target = (event.target as HTMLInputElement);
        let value: string | boolean = target.value;
        if (target.type === 'checkbox') {
            value = target.checked;
        }
        if (target.id === 'sendAll') {
            if (!value) {
                this.convertToFiat(this.state.amount);
            }
        } else if (target.id === 'amount') {
            this.convertToFiat(value);
        }
        this.setState(prevState => ({
            ...prevState,
            [target.id]: value,
        }), () => {
            this.validateAndDisplayFee(true);
        });
    }

    private handleFiatInput = (event: Event) => {
        const value = (event.target as HTMLInputElement).value;
        this.setState({ fiatAmount: value });
        this.convertFromFiat(value);
    }

    private convertToFiat = (value?: string | boolean) => {
        if (value) {
            const coinUnit = this.getAccount()!.coinUnit;
            apiGet(`coins/convertToFiat?from=${coinUnit}&to=${this.state.fiatUnit}&amount=${value}`)
                .then(data => {
                    if (data.success) {
                        this.setState({ fiatAmount: data.fiatAmount });
                    } else {
                        this.setState({ amountError: this.props.t('send.error.invalidAmount') });
                    }
                });
        } else {
            this.setState({ fiatAmount: '' });
        }
    }

    private convertFromFiat = (value: string) => {
        if (value) {
            const coinCode = this.getAccount()!.coinCode;
            apiGet(`coins/convertFromFiat?from=${this.state.fiatUnit}&to=${coinCode}&amount=${value}`)
                .then(data => {
                    if (data.success) {
                        this.setState({ amount: data.amount });
                        this.validateAndDisplayFee(false);
                    } else {
                        this.setState({ amountError: this.props.t('send.error.invalidAmount') });
                    }
                });
        } else {
            this.setState({ amount: '' });
        }
    }

    private sendToSelf = (event: React.SyntheticEvent) => {
        accountApi.getReceiveAddressList(this.getAccount()!.code)()
            .then(receiveAddresses => {
                this.setState({ recipientAddress: receiveAddresses[0].addresses[0].address });
                this.handleFormChange(event);
            })
            .catch(console.error);
    }

    private feeTargetChange = (feeTarget: accountApi.FeeTargetCode) => {
        this.setState(
            { feeTarget, customFee: '' },
            () => this.validateAndDisplayFee(this.state.sendAll),
        );
    }

    private onSelectedUTXOsChange = (selectedUTXOs: SelectedUTXO) => {
        this.selectedUTXOs = selectedUTXOs;
        this.validateAndDisplayFee(true);
    }

    private hasSelectedUTXOs = (): boolean => {
        return Object.keys(this.selectedUTXOs).length !== 0;
    }

    private getAccount = (): accountApi.IAccount | undefined => {
        if (!this.props.accounts) {
            return undefined;
        }
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    private toggleCoinControl = () => {
        this.setState(({ activeCoinControl }) => {
            if (activeCoinControl && this.utxos.current) {
                this.utxos.current.clear();
            }
            return { activeCoinControl: !activeCoinControl };
        });
    }

    private parseQRResult = (uri: string) => {
        let address;
        let amount = '';
        try {
            const url = new URL(uri);
            if (url.protocol !== 'bitcoin:' && url.protocol !== 'litecoin:' && url.protocol !== 'ethereum:') {
                alertUser(this.props.t('invalidFormat'));
                return;
            }
            address = url.pathname;
            if (this.isBitcoinBased()) {
                amount = url.searchParams.get('amount') || '';
            }
        } catch {
            address = uri;
        }
        let updateState = {
            recipientAddress: address,
            sendAll: false,
            fiatAmount: ''
        } as Pick<State, keyof State>;
        if (amount) {
            updateState['amount'] = amount;
        }
        this.setState(updateState, () => {
            this.convertToFiat(this.state.amount);
            this.validateAndDisplayFee(true);
        });
    }

    private toggleScanQR = () => {
        if (this.state.activeScanQR) {
            if (this.qrCodeReader) {
                // release camera; invokes the catch function below.
                this.qrCodeReader.reset();
            }
            // should already be false, set by the catch function below. we do it again anyway, in
            // case it is not called consistently on each platform.
            this.setState({ activeScanQR: false });
            return;
        }
        this.setState({
            activeScanQR: true,
            videoLoading: true,
        }, () => {
            this.qrCodeReader && this.qrCodeReader
                .decodeFromInputVideoDevice(undefined, 'video')
                .then(result => {
                    this.setState({ activeScanQR: false });
                    this.parseQRResult(result.getText());
                    if (this.qrCodeReader) {
                        this.qrCodeReader.reset(); // release camera
                    }
                })
                .catch((error) => {
                    if (error) {
                        alertUser(error.message || error);
                    }
                    this.setState({ activeScanQR: false });
                });
        });
    }

    private deactivateCoinControl = () => {
        this.setState({ activeCoinControl: false });
    }

    private handleVideoLoad = () => {
        this.setState({ videoLoading: false });
    }

    public render() {
        const { t, code } = this.props;
        const {
            balance,
            proposedFee,
            proposedTotal,
            recipientAddress,
            proposedAmount,
            valid,
            amount,
            /* data, */
            fiatAmount,
            fiatUnit,
            sendAll,
            feeTarget,
            customFee,
            isConfirming,
            isSent,
            isAborted,
            isUpdatingProposal,
            addressError,
            amountError,
            feeError,
            paired,
            signProgress,
            signConfirm,
            coinControl,
            activeCoinControl,
            hasCamera,
            activeScanQR,
            videoLoading,
            note,
        } = this.state;
        const account = this.getAccount();
        if (!account) {
            return null;
        }
        const confirmPrequel = (signProgress && signProgress.steps > 1) ? (
            <span>
                {
                    t('send.signprogress.description', {
                        steps: signProgress.steps.toString(),
                    })
                }
                <br />
                {t('send.signprogress.label')}: {signProgress.step}/{signProgress.steps}
            </span>
        ) : undefined;
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Status type="warning" hidden={paired !== false}>
                        {t('warning.sendPairing')}
                    </Status>
                    <Header title={<h2>{t('send.title', { accountName: account.coinName })}</h2>} />
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            <div>
                                <label className="labelXLarge">{t('send.availableBalance')}</label>
                            </div>
                            <div className="box large">
                                <Balance balance={balance} />
                            </div>
                            {
                                coinControl && (
                                    <UTXOs
                                        accountCode={account.code}
                                        active={activeCoinControl}
                                        explorerURL={account.blockExplorerTxPrefix}
                                        onClose={this.deactivateCoinControl}
                                        onChange={this.onSelectedUTXOsChange}
                                        ref={this.utxos}
                                    />
                                )
                            }
                            <div className={`flex flex-row flex-between ${style.container}`}>
                                <label className="labelXLarge">{t('send.transactionDetails')}</label>
                                { coinControl && (
                                    <A href="#" onClick={this.toggleCoinControl} className="labelLarge labelLink">{t('send.toggleCoinControl')}</A>
                                )}
                            </div>
                            <div className="box large m-bottom-default">
                                <div className="columnsContainer">
                                    <div className="columns">
                                        <div className="column">
                                            <Input
                                                label={t('send.address.label')}
                                                placeholder={t('send.address.placeholder')}
                                                id="recipientAddress"
                                                error={addressError}
                                                onInput={this.handleFormChange}
                                                value={recipientAddress}
                                                className={hasCamera ? style.inputWithIcon : ''}
                                                labelSection={debug ? (
                                                    <span id="sendToSelf" className={style.action} onClick={this.sendToSelf}>
                                                        Send to self
                                                    </span>
                                                ) : undefined}
                                                autoFocus>
                                                {
                                                    hasCamera && (
                                                        <button onClick={this.toggleScanQR} className={style.qrButton}>
                                                            <img src={qrcodeIcon} />
                                                        </button>
                                                    )
                                                }
                                            </Input>
                                        </div>
                                    </div>
                                    <div className="columns">
                                        <div className="column column-1-2">
                                            <Input
                                                type="number"
                                                step="any"
                                                min="0"
                                                label={balance ? balance.available.unit : t('send.amount.label')}
                                                id="amount"
                                                onInput={this.handleFormChange}
                                                disabled={sendAll}
                                                error={amountError}
                                                value={sendAll ? (proposedAmount ? proposedAmount.amount : '') : amount}
                                                placeholder={t('send.amount.placeholder')}
                                                labelSection={
                                                    <Checkbox
                                                        label={t(this.hasSelectedUTXOs() ? 'send.maximumSelectedCoins' : 'send.maximum')}
                                                        id="sendAll"
                                                        onChange={this.handleFormChange}
                                                        checked={sendAll}
                                                        className={style.maxAmount} />
                                                } />
                                        </div>
                                        <div className="column column-1-2">
                                            <Input
                                                type="number"
                                                step=".01"
                                                min="0"
                                                label={fiatUnit}
                                                id="fiatAmount"
                                                onInput={this.handleFiatInput}
                                                disabled={sendAll}
                                                error={amountError}
                                                value={fiatAmount}
                                                placeholder={t('send.amount.placeholder')} />
                                        </div>
                                    </div>
                                    <div className="columns">
                                        <div className="column column-1-2 m-bottom-half">
                                            <FeeTargets
                                                accountCode={account.code}
                                                coinCode={account.coinCode}
                                                disabled={!amount && !sendAll}
                                                fiatUnit={fiatUnit}
                                                proposedFee={proposedFee}
                                                customFee={customFee}
                                                showCalculatingFeeLabel={isUpdatingProposal}
                                                onFeeTargetChange={this.feeTargetChange}
                                                onCustomFee={customFee => this.setState({ customFee }, this.validateAndDisplayFee)}
                                                error={feeError}/>
                                        </div>
                                        <div className="column column-1-2">
                                            <Input
                                                label={t('note.title')}
                                                labelSection={
                                                    <span className={style.labelDescription}>
                                                        {t('note.input.description')}
                                                    </span>
                                                }
                                                id="note"
                                                onInput={this.handleNoteInput}
                                                value={note}
                                                placeholder={t('note.input.placeholder')} />
                                        </div>
                                    </div>
                                </div>
                                <div className="buttons ignore reverse m-top-none">
                                    <Button
                                        primary
                                        onClick={this.send}
                                        disabled={this.sendDisabled() || !valid || isUpdatingProposal}>
                                        {t('send.button')}
                                    </Button>
                                    <ButtonLink
                                        transparent
                                        to={`/account/${code}`}>
                                        {t('button.back')}
                                    </ButtonLink>
                                </div>
                            </div>
                        </div>
                    </div>
                    {
                        isConfirming && (
                            <WaitDialog
                                title={t('send.confirm.title')}
                                prequel={confirmPrequel}
                                paired={paired}
                                touchConfirm={signConfirm}
                                includeDefault>
                                <div className={style.confirmItem}>
                                    <label>{t('send.address.label')}</label>
                                    <p>{recipientAddress || 'N/A'}</p>
                                </div>
                                <div className={style.confirmItem}>
                                    <label>{t('send.amount.label')}</label>
                                    <p>
                                        <span key="proposedAmount">
                                            {(proposedAmount && proposedAmount.amount) || 'N/A'}
                                            {' '}
                                            <small>{(proposedAmount && proposedAmount.unit) || 'N/A'}</small>
                                        </span>
                                        {
                                            proposedAmount && proposedAmount.conversions && (
                                                <span> <span className="text-gray">/</span> {proposedAmount.conversions[fiatUnit]} <small>{fiatUnit}</small></span>
                                            )
                                        }
                                    </p>
                                </div>
                                {note ? (
                                    <div className={style.confirmItem}>
                                        <label>{t('note.title')}</label>
                                        <p>{note}</p>
                                    </div>
                                ) : null}
                                <div className={style.confirmItem}>
                                    <label>{t('send.fee.label')}{feeTarget ? ' (' + t(`send.feeTarget.label.${feeTarget}`) + ')' : ''}</label>
                                    <p>
                                        <span key="amount">
                                            {(proposedFee && proposedFee.amount) || 'N/A'}
                                            {' '}
                                            <small>{(proposedFee && proposedFee.unit) || 'N/A'}</small>
                                        </span>
                                        {proposedFee && proposedFee.conversions && (
                                            <span key="conversation">
                                                <span className="text-gray"> / </span>
                                                {proposedFee.conversions[fiatUnit]} <small>{fiatUnit}</small>
                                            </span>
                                        )}
                                        {customFee ? (
                                            <span key="customFee">
                                                <br/>
                                                <small>({customFee} {customFeeUnit(account.coinCode)})</small>
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                                {
                                    this.hasSelectedUTXOs() && (
                                        <div className={[style.confirmItem].join(' ')}>
                                            <label>{t('send.confirm.selected-coins')}</label>
                                            {
                                                Object.keys(this.selectedUTXOs).map((uxto, i) => (
                                                    <p className={style.confirmationValue} key={`selectedCoin-${i}`}>{uxto}</p>
                                                ))
                                            }
                                        </div>
                                    )
                                }
                                <div className={[style.confirmItem, style.total].join(' ')}>
                                    <label>{t('send.confirm.total')}</label>
                                    <p>
                                        <span>
                                            <strong>{(proposedTotal && proposedTotal.amount) || 'N/A'}</strong>
                                            {' '}
                                            <small>{(proposedTotal && proposedTotal.unit) || 'N/A'}</small>
                                        </span>
                                        {(proposedTotal && proposedTotal.conversions) && (
                                            <span> <span className="text-gray">/</span> <strong>{proposedTotal.conversions[fiatUnit]}</strong> <small>{fiatUnit}</small></span>
                                        )}
                                    </p>
                                </div>
                            </WaitDialog>
                        )
                    }
                    {
                        isSent && (
                            <WaitDialog>
                                <div className="flex flex-row flex-center flex-items-center">
                                    <Checked style={{height: 18, marginRight: '1rem'}} />{t('send.success')}
                                </div>
                            </WaitDialog>
                        )
                    }
                    {
                        isAborted && (
                            <WaitDialog>
                                <div className="flex flex-row flex-center flex-items-center">
                                    <Cancel alt="Abort" style={{height: 18, marginRight: '1rem'}} />{t('send.abort')}
                                </div>
                            </WaitDialog>
                        )
                    }
                    {
                        activeScanQR && (
                            <Dialog
                                title={t('send.scanQR')}
                                onClose={this.toggleScanQR}>
                                {videoLoading && <Spinner />}
                                <video
                                    id="video"
                                    width={400}
                                    height={300 /* fix height to avoid ugly resize effect after open */}
                                    className={style.qrVideo}
                                    onLoadedData={this.handleVideoLoad} />
                                <div className={['buttons', 'flex', 'flex-row', 'flex-between'].join(' ')}>
                                    <Button
                                        secondary
                                        onClick={this.toggleScanQR}>
                                        {t('button.back')}
                                    </Button>
                                </div>
                            </Dialog>
                        )
                    }
                </div>
                <Guide>
                    <Entry key="guide.send.whyFee" entry={t('guide.send.whyFee')} />
                    { isBitcoinBased(account.coinCode) && (
                        <Entry key="guide.send.priority" entry={t('guide.send.priority')} />
                    )}
                    { isBitcoinBased(account.coinCode) && (
                        <Entry key="guide.send.fee" entry={t('guide.send.fee')} />
                    )}
                    { isBitcoinOnly(account.coinCode) && (
                        <Entry key="guide.send.change" entry={t('guide.send.change')} />
                    )}
                    <Entry key="guide.send.revert" entry={t('guide.send.revert')} />
                    <Entry key="guide.send.plugout" entry={t('guide.send.plugout')} />
                </Guide>
            </div>
        );
    }
}

const TranslatedSend = translate()(Send);
export { TranslatedSend as Send };
