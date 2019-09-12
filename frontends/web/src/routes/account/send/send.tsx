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

import { BrowserQRCodeReader } from '@zxing/library';
import { Component, h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import reject from '../../../assets/icons/cancel.svg';
import approve from '../../../assets/icons/checked.svg';
import qrcodeIcon from '../../../assets/icons/qrcode.png';
import { alertUser } from '../../../components/alert/Alert';
import A from '../../../components/anchor/anchor';
import { Balance, BalanceInterface } from '../../../components/balance/balance';
import { Dialog } from '../../../components/dialog/dialog';
import { Button, ButtonLink, Checkbox, Input } from '../../../components/forms';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { Header } from '../../../components/layout';
import { Fiat, store as fiat } from '../../../components/rates/rates';
import Spinner from '../../../components/spinner/Spinner';
import Status from '../../../components/status/status';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import { translate, TranslateProps } from '../../../decorators/translate';
import { debug } from '../../../utils/env';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { Devices } from '../../device/deviceswitch';
import { isBitcoinBased } from '../utils';
import FeeTargets from './feetargets';
import * as style from './send.css';
import { Props as UTXOsProps, SelectedUTXO, UTXOs } from './utxos';

interface SendProps {
    accounts: Account[];
    code?: string;
    devices: Devices;
    deviceIDs: string[];
}

interface Account {
    code: string;
    coinCode: string;
}

interface ProposedAmount {
    amount: string;
    unit: string;
    conversions: Conversions;
}

interface Conversions {
    [key: string]: Fiat;
}

interface SignProgress {
    steps: number;
    step: number;
}

type Props = SendProps & TranslateProps;

interface State {
    account?: Account;
    balance?: BalanceInterface;
    proposedFee?: ProposedAmount;
    proposedTotal?: ProposedAmount;
    recipientAddress?: string;
    proposedAmount?: ProposedAmount;
    valid: boolean;
    amount?: string;
    data?: string;
    fiatAmount?: string;
    fiatUnit: string;
    sendAll: boolean;
    feeTarget?: string;
    isConfirming: boolean;
    isSent: boolean;
    isAborted: boolean;
    addressError?: string;
    amountError?: string;
    dataError?: string;
    paired?: boolean;
    noMobileChannelError?: boolean;
    signProgress?: SignProgress;
    // show visual BitBox in dialog when instructed to sign.
    // can't be undefined because of the default touchConfirm param in the wait dialog.
    signConfirm: boolean | null;
    coinControl: boolean;
    activeCoinControl: boolean;
    hasCamera: boolean;
    activeScanQR: boolean;
    videoLoading: boolean;
}

class Send extends Component<Props, State> {
    private utxos!: Component<UTXOsProps>;
    private selectedUTXOs: SelectedUTXO = {};
    private unsubscribe!: () => void;
    private qrCodeReader: BrowserQRCodeReader = new BrowserQRCodeReader();

    constructor(props) {
        super(props);
        this.state = {
            valid: false,
            sendAll: false,
            isConfirming: false,
            signConfirm: null,
            isSent: false,
            isAborted: false,
            noMobileChannelError: false,
            fiatUnit: fiat.state.active,
            coinControl: false,
            activeCoinControl: false,
            hasCamera: false,
            activeScanQR: false,
            videoLoading: false,
        };
    }

    private coinSupportsCoinControl = () => {
        const account = this.getAccount();
        if (!account) {
            return false;
        }
        return isBitcoinBased(account.coinCode);
    }

    public componentDidMount() {
        apiGet(`account/${this.props.code}/balance`).then(balance => this.setState({ balance }));
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
        if (this.coinSupportsCoinControl()) {
            apiGet('config').then(config => this.setState({ coinControl: !!(config.frontend || {}).coinControl }));
        }
        this.unsubscribe = apiWebsocket(({ type, data, meta }) => {
            switch (type) {
                case 'device':
                    switch (data) {
                        case 'signProgress':
                            this.setState({ signProgress: meta, signConfirm: null });
                            break;
                        case 'signConfirm':
                            this.setState({ signConfirm: true });
                            break;
                    }
                    break;
            }
        });
    }

    public componentWillMount() {
        this.registerEvents();
        this.qrCodeReader
            .getVideoInputDevices()
            .then(videoInputDevices => {
                this.setState({ hasCamera: videoInputDevices.length > 0 });
            });
    }

    public componentWillUnmount() {
        this.unregisterEvents();
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        this.qrCodeReader.reset();
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
        apiPost('account/' + this.getAccount()!.code + '/sendtx', this.txInput()).then(result => {
            if (result.success) {
                this.setState({
                    sendAll: false,
                    isConfirming: false,
                    isSent: true,
                    recipientAddress: undefined,
                    proposedAmount: undefined,
                    proposedFee: undefined,
                    proposedTotal: undefined,
                    fiatAmount: undefined,
                    amount: undefined,
                    data: undefined,
                });
                if (this.utxos) {
                    (this.utxos as any).getWrappedInstance().clear();
                }
                setTimeout(() => this.setState({
                    isSent: false,
                    isConfirming: false,
                }), 5000);
            } else if (result.aborted) {
                this.setState({ isAborted: true });
                setTimeout(() => this.setState({ isAborted: false }), 5000);
            } else {
                alertUser(this.props.t('unknownError', { errorMessage: result.errorMessage }));
            }
            // The following method allows pressing escape again.
            this.setState({ isConfirming: false, signProgress: undefined, signConfirm: null });
        }).catch(() => {
            this.setState({ isConfirming: false, signProgress: undefined, signConfirm: null });
        });
    }

    private txInput = () => ({
        address: this.state.recipientAddress,
        amount: this.state.amount,
        feeTarget: this.state.feeTarget || '',
        sendAll: this.state.sendAll ? 'yes' : 'no',
        selectedUTXOs: Object.keys(this.selectedUTXOs),
        data: this.state.data,
    })

    private sendDisabled = () => {
        const txInput = this.txInput();
        return !txInput.address || this.state.feeTarget === undefined || (txInput.sendAll === 'no' && !txInput.amount);
    }

    private validateAndDisplayFee = (updateFiat: boolean) => {
        this.setState({
            proposedTotal: undefined,
            addressError: undefined,
            amountError: undefined,
            dataError: undefined,
        });
        if (this.sendDisabled()) {
            return;
        }
        const txInput = this.txInput();
        apiPost('account/' + this.getAccount()!.code + '/tx-proposal', txInput).then(result => {
            this.setState({ valid: result.success });
            if (result.success) {
                this.setState({
                    addressError: undefined,
                    amountError: undefined,
                    dataError: undefined,
                    proposedFee: result.fee,
                    proposedAmount: result.amount,
                    proposedTotal: result.total,
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
                        this.setState({ amountError: this.props.t(`send.error.${errorCode}`) });
                        break;
                    case 'invalidData':
                        this.setState({ dataError: this.props.t(`send.error.invalidData`) });
                        break;
                    default:
                        this.setState({ proposedFee: undefined });
                        if (errorCode) {
                            this.unregisterEvents();
                            alertUser(errorCode, this.registerEvents);
                        }
                }
            }
        }).catch(() => {
            this.setState({ valid: false });
        });
    }

    private handleFormChange = (event: Event) => {
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
        }));
        this.validateAndDisplayFee(true);
    }

    private handleFiatInput = (event: Event) => {
        const value = (event.target as HTMLInputElement).value;
        this.setState({ fiatAmount: value });
        this.convertFromFiat(value);
    }

    private convertToFiat = (value?: string | boolean) => {
        if (value) {
            let coinUnit = this.getAccount()!.coinCode.toUpperCase();
            if (coinUnit.length === 4 && coinUnit.startsWith('T') || coinUnit === 'RETH') {
                coinUnit = coinUnit.substring(1);
            }
            apiGet(`coins/convertToFiat?from=${coinUnit}&to=${this.state.fiatUnit}&amount=${value}`)
                .then(data => {
                    if (data.success) {
                        this.setState({ fiatAmount: data.fiatAmount });
                    } else {
                        this.setState({ amountError: this.props.t(`send.error.invalidAmount`) });
                    }
                });
        } else {
            this.setState({ fiatAmount: undefined });
        }
    }

    private convertFromFiat = (value: string) => {
        if (value) {
            let coinUnit = this.getAccount()!.coinCode.toUpperCase();
            if (coinUnit.length === 4 && coinUnit.startsWith('T') || coinUnit === 'RETH') {
                coinUnit = coinUnit.substring(1);
            }
            apiGet(`coins/convertFromFiat?from=${this.state.fiatUnit}&to=${coinUnit}&amount=${value}`)
                .then(data => {
                    if (data.success) {
                        this.setState({ amount: data.amount });
                        this.validateAndDisplayFee(false);
                    } else {
                        this.setState({ amountError: this.props.t(`send.error.invalidAmount`) });
                    }
                });
        } else {
            this.setState({ amount: undefined });
        }
    }

    private sendAll = (event: Event) => {
        this.handleFormChange(event);
    }

    private sendToSelf = (event: Event) => {
        apiGet('account/' + this.getAccount()!.code + '/receive-addresses').then(receiveAddresses => {
            this.setState({ recipientAddress: receiveAddresses[0].address });
            this.handleFormChange(event);
        });
    }

    private feeTargetChange = (feeTarget: string) => {
        this.setState({ feeTarget });
        this.validateAndDisplayFee(this.state.sendAll);
    }

    private onSelectedUTXOsChange = (selectedUTXOs: SelectedUTXO) => {
        this.selectedUTXOs = selectedUTXOs;
        this.validateAndDisplayFee(true);
    }

    private getAccount = () => {
        if (!this.props.accounts) {
            return undefined;
        }
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    private toggleCoinControl = () => {
        this.setState(({ activeCoinControl }) => {
            if (activeCoinControl && this.utxos) {
                (this.utxos as any).getWrappedInstance().clear();
            }
            return { activeCoinControl: !activeCoinControl };
        });
    }

    private setUTXOsRef = (ref: Component<UTXOsProps>) => {
        this.utxos = ref;
    }

    private parseQRResult = uri => {
        let address;
        let amount: string | undefined;
        try {
            const url = new URL(uri);
            if (url.protocol !== 'bitcoin:' && url.protocol !== 'litecoin:') {
                alertUser(this.props.t('invalidFormat'));
                return;
            }
            address = url.pathname;
            amount = url.searchParams.get('amount') || undefined;
        } catch {
            address = uri;
        }
        this.setState({
            recipientAddress: address,
            sendAll: false,
            amount,
            fiatAmount: undefined,
        });
        // TODO: similar to handleFormChange(). Refactor.
        if (amount !== undefined) {
            this.convertToFiat(amount);
        }
        this.validateAndDisplayFee(true);
    }

    private toggleScanQR = () => {
        if (this.state.activeScanQR) {
            // release camera; invokes the catch function below.
            this.qrCodeReader.reset();
            // should already be false, set by the catch function below. we do it again anyway, in
            // case it is not called consistently on each platform.
            this.setState({ activeScanQR: false });
            return;
        }
        this.setState({
            activeScanQR: true,
            videoLoading: true,
        }, () => {
            this.qrCodeReader
                .decodeFromInputVideoDevice(undefined, 'video')
                .then(result => {
                    this.setState({ activeScanQR: false });
                    this.parseQRResult(result.getText());
                    this.qrCodeReader.reset(); // release camera
                })
                .catch(() => {
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

    public render(
        { t, code }: RenderableProps<Props>,
        {
            balance,
            proposedFee,
            proposedTotal,
            recipientAddress,
            proposedAmount,
            valid,
            amount,
            data,
            fiatAmount,
            fiatUnit,
            sendAll,
            feeTarget,
            isConfirming,
            isSent,
            isAborted,
            addressError,
            amountError,
            dataError,
            paired,
            signProgress,
            signConfirm,
            coinControl,
            activeCoinControl,
            hasCamera,
            activeScanQR,
            videoLoading,
        }: State,
    ) {
        const account = this.getAccount();
        if (!account) {
            return null;
        }
        const confirmPrequel = signProgress && signProgress.steps > 1 && (
            <span>
                {
                    t('send.signprogress.description', {
                        steps: signProgress.steps.toString(),
                    })
                }
                <br />
                {t('send.signprogress.label')}: {signProgress.step}/{signProgress.steps}
            </span>
        );
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Status type="warning">
                        {paired === false && t('warning.sendPairing')}
                    </Status>
                    <Header title={<h2>{t('send.title')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div className="flex flex-row flex-between">
                                <label className="labelLarge">Available Balance</label>
                                {
                                    coinControl && (
                                        <A href="#" onClick={this.toggleCoinControl} className="labelLarge labelLink">{t('send.toggleCoinControl')}</A>
                                    )
                                }
                            </div>
                            <div className="box large">
                                <Balance balance={balance} />
                            </div>
                            {
                                coinControl && (
                                    <UTXOs
                                        accountCode={account.code}
                                        active={activeCoinControl}
                                        onClose={this.deactivateCoinControl}
                                        onChange={this.onSelectedUTXOsChange}
                                        ref={this.setUTXOsRef}
                                    />
                                )
                            }
                            <div className={style.container}>
                                <label className="labelLarge">Transaction Details</label>
                            </div>
                            <div className="box large m-bottom-default">
                                <div className="columnsContainer">
                                    <div class="columns">
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
                                                            <img src={qrcodeIcon}/>
                                                        </button>
                                                    )
                                                }
                                            </Input>
                                        </div>
                                    </div>
                                    <div className="columns">
                                        <div className="column column-1-2">
                                            <Input
                                                label={t('send.amount.label')}
                                                id="amount"
                                                onInput={this.handleFormChange}
                                                disabled={sendAll}
                                                error={amountError}
                                                value={sendAll ? proposedAmount && proposedAmount.amount : amount}
                                                placeholder={`${t('send.amount.placeholder')} ` + (balance && `(${balance.available.unit})`)}
                                                labelSection={
                                                    <Checkbox
                                                        label={t('send.maximum')}
                                                        id="sendAll"
                                                        onChange={this.sendAll}
                                                        checked={sendAll}
                                                        className={style.maxAmount} />
                                                } />
                                        </div>
                                        <div className="column column-1-2">
                                            <Input
                                                label={fiatUnit}
                                                id="fiatAmount"
                                                onInput={this.handleFiatInput}
                                                disabled={sendAll}
                                                error={amountError}
                                                value={fiatAmount}
                                                placeholder={`${t('send.amount.placeholder')} (${fiatUnit})`} />
                                        </div>
                                    </div>
                                    <div className="columns">
                                        <div className="column column-1-2">
                                            <FeeTargets
                                                // label={t('send.feeTarget.label')}
                                                label="Priority"
                                                placeholder={t('send.feeTarget.placeholder')}
                                                accountCode={account.code}
                                                disabled={!amount && !sendAll}
                                                onFeeTargetChange={this.feeTargetChange} />
                                        </div>
                                        <div className="column column-1-2">
                                            <Input
                                                label={t('send.fee.label')}
                                                id="proposedFee"
                                                value={proposedFee && proposedFee.amount + ' ' + proposedFee.unit + (proposedFee.conversions ? ' = ' + proposedFee.conversions[fiatUnit] + ' ' + fiatUnit : '')}
                                                placeholder={feeTarget === 'custom' ? t('send.fee.customPlaceholder') : t('send.fee.placeholder')}
                                                disabled={feeTarget !== 'custom'}
                                                transparent />
                                        </div>
                                    </div>
                                    {
                                        feeTarget && (
                                            <p class={style.feeDescription}>{t('send.feeTarget.description.' + feeTarget)}</p>
                                        )
                                    }
                                </div>
                                {
                                    (account.coinCode === 'eth' || account.coinCode === 'teth' || account.coinCode === 'reth') && (
                                        <div class="row">
                                            <Input
                                                label={t('send.data.label')}
                                                placeholder={t('send.data.placeholder')}
                                                id="data"
                                                error={dataError}
                                                onInput={this.handleFormChange}
                                                value={data} />
                                        </div>
                                    )
                                }
                                <div class="buttons ignore reverse">
                                    <Button primary onClick={this.send} disabled={this.sendDisabled() || !valid}>
                                        {t('send.button')}
                                    </Button>
                                    <ButtonLink
                                        transparent
                                        href={`/account/${code}`}>
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
                                <div class={style.confirmationBox}>
                                    <div class={style.block}>
                                        <p class={['label', style.confirmationLabel, 'first'].join(' ')}>
                                            {t('send.address.label')}
                                        </p>
                                        <p class={style.confirmationValue}>{recipientAddress || 'N/A'}</p>
                                    </div>
                                    <div class={['flex flex-row flex-start', style.block, style.ignorePadding].join(' ')}>
                                        <div class={style.half}>
                                            <p class={['label', style.confirmationLabel].join(' ')}>
                                                {t('send.amount.label')}
                                            </p>
                                            <table class={style.confirmationValueTable} align="right">
                                                <tr>
                                                    <td>{proposedAmount && proposedAmount.amount || 'N/A'}</td>
                                                    <td>{proposedAmount && proposedAmount.unit || 'N/A'}</td>
                                                </tr>
                                                {
                                                    proposedAmount && proposedAmount.conversions && (
                                                        <tr>
                                                            <td>{proposedAmount.conversions[fiatUnit]}</td>
                                                            <td>{fiatUnit}</td>
                                                        </tr>
                                                    )
                                                }
                                            </table>
                                        </div>
                                        <div class={style.half}>
                                            <p class={['label', style.confirmationLabel].join(' ')}>
                                                {t('send.fee.label')}
                                                {feeTarget ? ' (' + t(`send.feeTarget.label.${feeTarget}`) + ')' : ''}
                                            </p>
                                            <table class={style.confirmationValueTable} align="right">
                                                <tr>
                                                    <td>{proposedFee && proposedFee.amount || 'N/A'}</td>
                                                    <td>{proposedFee && proposedFee.unit || 'N/A'}</td>
                                                </tr>
                                                {
                                                    proposedFee && proposedFee.conversions && (
                                                        <tr>
                                                            <td>{proposedFee.conversions[fiatUnit]}</td>
                                                            <td>{fiatUnit}</td>
                                                        </tr>
                                                    )
                                                }
                                            </table>
                                        </div>
                                    </div>
                                    {
                                        Object.keys(this.selectedUTXOs).length !== 0 && (
                                            <div class={style.block}>
                                                <p class={['label', style.confirmationLabel].join(' ')}>
                                                    {t('send.confirm.selected-coins')}
                                                </p>
                                                {
                                                    Object.keys(this.selectedUTXOs).map((uxto, i) => (
                                                        <p class={style.confirmationValue} key={`selectedCoin-${i}`}>{uxto}</p>
                                                    ))
                                                }
                                            </div>
                                        )
                                    }
                                    <div class={style.block}>
                                        <p class={['label', style.confirmationLabel].join(' ')}>
                                            {t('send.confirm.total')}
                                        </p>
                                        <div>
                                            <table class={[style.confirmationValueTable, style.total].join(' ')} align="right">
                                                <tr>
                                                    <td>{proposedTotal && proposedTotal.amount || 'N/A'}</td>
                                                    <td>{proposedTotal && proposedTotal.unit || 'N/A'}</td>
                                                </tr>
                                                {
                                                    (proposedTotal && proposedTotal.conversions) && (
                                                        <tr>
                                                            <td>{proposedTotal.conversions[fiatUnit]}</td>
                                                            <td>{fiatUnit}</td>
                                                        </tr>
                                                    )
                                                }
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </WaitDialog>
                        )
                    }
                    {
                        isSent && (
                            <WaitDialog>
                                <div class="flex flex-row flex-center flex-items-center text-bold">
                                    <img src={approve} alt="Success" style="height: 40px; margin-right: 1rem;" />{t('send.success')}
                                </div>
                            </WaitDialog>
                        )
                    }
                    {
                        isAborted && (
                            <WaitDialog>
                                <div class="flex flex-row flex-center flex-items-center text-bold">
                                    <img src={reject} alt="Abort" style="height: 40px; margin-right: 1rem;" />{t('send.abort')}
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
                                <div class={['buttons', 'flex', 'flex-row', 'flex-between'].join(' ')}>
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
                    {
                        isBitcoinBased(account.coinCode) && (
                            <Entry key="guide.send.priority" entry={t('guide.send.priority')} />
                        )
                    }
                    {
                        isBitcoinBased(account.coinCode) && (
                            <Entry key="guide.send.fee" entry={t('guide.send.fee')} />
                        )
                    }
                    <Entry key="guide.send.revert" entry={t('guide.send.revert')} />
                </Guide>
            </div>
        );
    }
}

const TranslatedSend = translate<SendProps>()(Send);
export { TranslatedSend as Send };
