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
import reject from '../../../assets/icons/cancel.svg';
import approve from '../../../assets/icons/checked.svg';
import { alertUser } from '../../../components/alert/Alert';
import { Balance, BalanceInterface } from '../../../components/balance/balance';
import { Button, ButtonLink, Checkbox, Input } from '../../../components/forms';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { Header } from '../../../components/layout';
import { Fiat, store as fiat } from '../../../components/rates/rates';
import Status from '../../../components/status/status';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import { translate, TranslateProps } from '../../../decorators/translate';
import { debug } from '../../../utils/env';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { isBitcoinBased } from '../utils';
import FeeTargets from './feetargets';
import * as style from './send.css';
import { Props as UTXOsProps, SelectedUTXO, UTXOs } from './utxos';

interface SendProps {
    accounts: Account[];
    code?: string;
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
    account: Account | null | undefined;
    balance: BalanceInterface | null;
    proposedFee: ProposedAmount | null;
    proposedTotal: ProposedAmount | null;
    recipientAddress: string | null;
    proposedAmount: ProposedAmount | null;
    valid: boolean;
    amount: string | null;
    data: string | null;
    fiatAmount: string | null;
    fiatUnit: string;
    sendAll: boolean;
    feeTarget: string | null;
    isConfirming: boolean;
    isSent: boolean;
    isAborted: boolean;
    addressError: string | null;
    amountError: string | null;
    dataError: string | null;
    paired: boolean | null;
    noMobileChannelError: boolean;
    signProgress: SignProgress | null;
    signConfirm: boolean | null;
    coinControl: boolean;
    activeCoinControl: boolean;
}

class Send extends Component<Props, State> {
    private utxos!: Component<UTXOsProps>;
    private selectedUTXOs: SelectedUTXO = {};
    private unsubscribe!: () => void;

    constructor(props) {
        super(props);
        this.state = {
            account: this.getAccount(),
            recipientAddress: null,
            balance: null,
            amount: null,
            feeTarget: null,
            proposedFee: null,
            proposedAmount: null,
            proposedTotal: null,
            valid: false,
            addressError: null,
            amountError: null,
            dataError: null,
            sendAll: false,
            isConfirming: false,
            isSent: false,
            isAborted: false,
            paired: null,
            noMobileChannelError: false,
            fiatAmount: null,
            fiatUnit: fiat.state.active,
            signProgress: null,
            signConfirm: null, // show visual BitBox in dialog when instructed to sign.
            coinControl: false,
            activeCoinControl: false,
            data: null,
        };
    }

    private coinSupportsCoinControl = () => {
        if (!this.state.account) {
            return false;
        }
        return isBitcoinBased(this.state.account.coinCode);
    }

    public componentDidMount() {
        apiGet(`account/${this.props.code}/balance`).then(balance => this.setState({ balance }));
        if (this.props.deviceIDs.length > 0) {
            apiGet('devices/' + this.props.deviceIDs[0] + '/has-mobile-channel').then((mobileChannel: boolean) => {
                apiGet('devices/' + this.props.deviceIDs[0] + '/info').then(({ pairing }) => {
                    const account = this.state.account;
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
    }

    public componentWillUnmount() {
        this.unregisterEvents();
        if (this.unsubscribe) {
            this.unsubscribe();
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
            route(`/account/${this.props.code}`);
        }
    }

    private send = () => {
        if (this.state.noMobileChannelError) {
            alertUser(this.props.t('warning.sendPairing'));
            return;
        }
        this.setState({ signProgress: null, isConfirming: true });
        apiPost('account/' + this.state.account!.code + '/sendtx', this.txInput()).then(result => {
            if (result.success) {
                this.setState({
                    sendAll: false,
                    isConfirming: false,
                    isSent: true,
                    recipientAddress: null,
                    proposedAmount: null,
                    proposedFee: null,
                    proposedTotal: null,
                    fiatAmount: null,
                    amount: null,
                    data: null,
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
            this.setState({ isConfirming: false, signProgress: null, signConfirm: null });
        }).catch(() => {
            this.setState({ isConfirming: false, signProgress: null, signConfirm: null });
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
        return !txInput.address || this.state.feeTarget === null || (txInput.sendAll === 'no' && !txInput.amount);
    }

    private validateAndDisplayFee = (updateFiat: boolean) => {
        this.setState({
            proposedTotal: null,
            addressError: null,
            amountError: null,
            dataError: null,
        });
        if (this.sendDisabled()) {
            return;
        }
        const txInput = this.txInput();
        apiPost('account/' + this.state.account!.code + '/tx-proposal', txInput).then(result => {
            this.setState({ valid: result.success });
            if (result.success) {
                this.setState({
                    addressError: null,
                    amountError: null,
                    dataError: null,
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
                    this.setState({ proposedFee: null });
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

    private convertToFiat = (value: string | boolean | null) => {
        if (value) {
            let coinUnit = this.state.account!.coinCode.toUpperCase();
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
            this.setState({ fiatAmount: null });
        }
    }

    private convertFromFiat = (value: string) => {
        if (value) {
            let coinUnit = this.state.account!.coinCode.toUpperCase();
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
            this.setState({ amount: null });
        }
    }

    private sendAll = (event: Event) => {
        this.handleFormChange(event);
    }

    private sendToSelf = (event: Event) => {
        apiGet('account/' + this.state.account!.code + '/receive-addresses').then(receiveAddresses => {
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
            return null;
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

    public render(
        { t, code }: RenderableProps<Props>,
        {
            account,
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
        }: State,
    ) {
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
                    <Header title={<h2>{t('send.title')}</h2>}>
                        <Balance balance={balance} />
                        {
                            coinControl && (
                                <div style="align-self: flex-end;">
                                    <Button onClick={this.toggleCoinControl} primary>{t('send.toggleCoinControl')}</Button>
                                </div>
                            )
                        }
                    </Header>
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            {
                                coinControl && (
                                    <UTXOs
                                        accountCode={account.code}
                                        active={activeCoinControl}
                                        onChange={this.onSelectedUTXOsChange}
                                        ref={this.setUTXOsRef}
                                    />
                                )
                            }
                            <div class="row">
                                <Input
                                    label={t('send.address.label')}
                                    placeholder={t('send.address.placeholder')}
                                    id="recipientAddress"
                                    error={addressError}
                                    onInput={this.handleFormChange}
                                    value={recipientAddress}
                                    autoFocus
                                />
                                {
                                    debug && (
                                        <span id="sendToSelf" className={style.action} onClick={this.sendToSelf}>
                                            Send to self
                                        </span>
                                    )
                                }
                            </div>
                            <div class="row">
                                <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                    <Input
                                        label={t('send.amount.label')}
                                        id="amount"
                                        onInput={this.handleFormChange}
                                        disabled={sendAll}
                                        error={amountError}
                                        value={sendAll ? proposedAmount && proposedAmount.amount : amount}
                                        placeholder={`${t('send.amount.placeholder')} ` + (balance && `(${balance.available.unit})`)} />
                                    <Input
                                        label={fiatUnit}
                                        id="fiatAmount"
                                        onInput={this.handleFiatInput}
                                        disabled={sendAll}
                                        error={amountError}
                                        value={fiatAmount}
                                        placeholder={`${t('send.amount.placeholder')} (${fiatUnit})`} />
                                </div>
                                <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                    <Checkbox
                                        label={t('send.maximum')}
                                        id="sendAll"
                                        onChange={this.sendAll}
                                        checked={sendAll}
                                        className={style.maxAmount} />
                                </div>
                            </div>
                            <div class="row">
                                <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                    <FeeTargets
                                        label={t('send.feeTarget.label')}
                                        placeholder={t('send.feeTarget.placeholder')}
                                        accountCode={account.code}
                                        disabled={!amount && !sendAll}
                                        onFeeTargetChange={this.feeTargetChange} />
                                    <Input
                                        label={t('send.fee.label')}
                                        id="proposedFee"
                                        value={proposedFee && proposedFee.amount + ' ' + proposedFee.unit + (proposedFee.conversions ? ' = ' + proposedFee.conversions[fiatUnit] + ' ' + fiatUnit : '')}
                                        placeholder={feeTarget === 'custom' ? t('send.fee.customPlaceholder') : t('send.fee.placeholder')}
                                        disabled={feeTarget !==  'custom'}
                                        transparent />
                                    {/*
                                    <Input
                                        label={t('send.customFee.label')}
                                        placeholder={t('send.customFee.placeholder')}
                                        disabled
                                    />
                                    */}
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
                            <div class="row buttons flex flex-row flex-between flex-start">
                                <ButtonLink
                                    secondary
                                    href={`/account/${code}`}>
                                    {t('button.back')}
                                </ButtonLink>
                                <Button primary onClick={this.send} disabled={this.sendDisabled() || !valid}>
                                    {t('send.button')}
                                </Button>
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
                                                { feeTarget ? ' (' + t(`send.feeTarget.label.${feeTarget}`) + ')' : '' }
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
