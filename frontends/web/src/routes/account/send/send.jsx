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

import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { debug } from '../../../utils/env';
import { Button, ButtonLink, Checkbox, Input } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import Status from '../../../components/status/status';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import Header from '../../../components/header/Header';
import ButtonGroup from '../../../components/buttonGroup/ButtonGroup';
import Balance from '../../../components/balance/balance';
import FeeTargets from './feetargets';
import UTXOs from './utxos';
import approve from '../../../assets/icons/checked.svg';
import reject from '../../../assets/icons/cancel.svg';
import style from './send.css';

@translate()
export default class Send extends Component {

    constructor(props) {
        super(props);

        this.state = {
            balance: null,
            amount: null,
            feeTarget: null,
            proposedFee: null,
            proposedAmount: null,
            proposedTotal: null,
            valid: false,
            addressError: null,
            amountError: null,
            sendAll: false,
            isConfirming: false,
            isSent: false,
            isAborted: false,
            paired: null,
            fiatAmount: null,
            fiatUnit: props.fiat.code,
            signProgress: null,
            signConfirm: null, // show visual BitBox in dialog when instructed to sign.
            coinControl: false,
        };
        this.selectedUTXOs = [];
    }

    componentDidMount() {
        apiGet(`account/${this.props.code}/balance`).then(balance => this.setState({ balance }));
        if (this.props.deviceIDs.length > 0) {
            apiGet('devices/' + this.props.deviceIDs[0] + '/paired').then((paired) => {
                this.setState({ paired });
            });
        }
        apiGet('config').then(config => this.setState({ coinControl: !!(config.frontend || {}).coinControl }));
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

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        this.unsubscribe();
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = e => {
        if (e.keyCode === 27) {
            console.log('send.jsx route to /'); // eslint-disable-line no-console
            route(`/account/${this.props.code}`);
        }
    }

    send = () => {
        this.setState({ signProgress: null, isConfirming: true });
        apiPost('account/' + this.getAccount().code + '/sendtx', this.txInput()).then(result => {
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
                });
                if (this.utxos) {
                    this.utxos.clear();
                }
                setTimeout(() => this.setState({ isSent: false, isConfirming: false }), 5000);
            } else {
                this.setState({
                    isAborted: true,
                });
                setTimeout(() => this.setState({ isAborted: false }), 5000);
            }
            // The following method allows pressing escape again.
            this.setState({ isConfirming: false,signProgress: null, signConfirm: null });
        }).catch(() => {
            this.setState({ isConfirming: false,signProgress: null, signConfirm: null });
        });
    }

    txInput = () => ({
        address: this.state.recipientAddress,
        amount: this.state.amount,
        feeTarget: this.state.feeTarget,
        sendAll: this.state.sendAll ? 'yes' : 'no',
        selectedUTXOs: Object.keys(this.selectedUTXOs),
    })

    sendDisabled = () => {
        const txInput = this.txInput();
        return !txInput.address || !txInput.feeTarget || (txInput.sendAll === 'no' && !txInput.amount);
    }

    validateAndDisplayFee = updateFiat => {
        this.setState({
            proposedTotal: null,
            addressError: null,
            amountError: null,
        });
        if (this.sendDisabled()) {
            return;
        }
        const txInput = this.txInput();
        apiPost('account/' + this.getAccount().code + '/tx-proposal', txInput).then(result => {
            this.setState({ valid: result.success });
            if (result.success) {
                this.setState({
                    proposedFee: result.fee,
                    proposedAmount: result.amount,
                    proposedTotal: result.total,
                });
                if (updateFiat) {
                    this.convertToFiat(result.amount.amount);
                }
            } else {
                const error = result.errMsg;
                switch (error) {
                case 'invalid address':
                    this.setState({ addressError: error });
                    break;
                case 'invalid amount':
                case 'insufficient funds':
                    this.setState({ amountError: error });
                    break;
                default:
                    this.setState({ proposedFee: null });
                    if (error) {
                        alert(error); // eslint-disable-line no-alert
                    }
                }
            }
        }).catch(() => {
            this.setState({ valid: false });
        });
    }

    handleFormChange = event => {
        let value = event.target.value;
        if (event.target.type === 'checkbox') {
            value = event.target.checked;
        }
        if (event.target.id === 'sendAll') {
            if (!value) {
                this.convertToFiat(this.state.amount);
            }
        } else if (event.target.id === 'amount') {
            this.convertToFiat(value);
        }
        this.setState({ [event.target.id]: value });
        this.validateAndDisplayFee(true);
    }

    handleFiatInput = event => {
        const value = event.target.value;
        this.setState({ fiatAmount: value });
        this.convertFromFiat(value);
    }

    convertToFiat = value => {
        if (value) {
            let coinUnit = this.getAccount().coinCode.toUpperCase();
            if (coinUnit.length === 4 && coinUnit.startsWith('T')) {
                coinUnit = coinUnit.substring(1);
            }
            apiGet(`coins/convertToFiat?from=${coinUnit}&to=${this.state.fiatUnit}&amount=${value}`)
                .then(data => {
                    if (data.success) {
                        this.setState({ fiatAmount: data.fiatAmount });
                    } else {
                        this.setState({ amountError: 'invalid amount' });
                    }
                });
        } else {
            this.setState({ fiatAmount: null });
        }
    }

    convertFromFiat = value => {
        if (value) {
            let coinUnit = this.getAccount().coinCode.toUpperCase();
            if (coinUnit.length === 4 && coinUnit.startsWith('T')) {
                coinUnit = coinUnit.substring(1);
            }
            apiGet(`coins/convertFromFiat?from=${this.state.fiatUnit}&to=${coinUnit}&amount=${value}`)
                .then(data => {
                    if (data.success) {
                        this.setState({ amount: data.amount });
                        this.validateAndDisplayFee(false);
                    } else {
                        this.setState({ amountError: 'invalid amount' });
                    }
                });
        } else {
            this.setState({ amount: null });
        }
    }

    sendAll = event => {
        this.handleFormChange(event);
    }

    sendToSelf = event => {
        apiGet('account/' + this.getAccount().code + '/receive-addresses').then(receiveAddresses => {
            this.setState({ recipientAddress: receiveAddresses[0].address });
            this.handleFormChange(event);
        });
    }

    feeTargetChange = feeTarget => {
        this.setState({ feeTarget });
        this.validateAndDisplayFee(this.state.sendAll);
    }

    onSelectedUTXOsChange = selectedUTXOs => {
        this.selectedUTXOs = selectedUTXOs;
        this.validateAndDisplayFee(true);
    }

    getAccount() {
        if (!this.props.accounts) return null;
        return this.props.accounts.find(({ code }) => code === this.props.code);
    }

    render({
        t,
        code,
        sidebar,
        guide,
        fiat,
    }, {
        balance,
        proposedFee,
        proposedTotal,
        recipientAddress,
        proposedAmount,
        valid,
        amount,
        fiatAmount,
        fiatUnit,
        sendAll,
        feeTarget,
        isConfirming,
        isSent,
        isAborted,
        addressError,
        amountError,
        paired,
        signProgress,
        signConfirm,
        coinControl,
    }) {
        const account = this.getAccount();
        if (!account) return null;

        let confirmPrequel = () => {
            if (signProgress && signProgress.steps > 1) {
                return (
                    <span>
                        This is a transaction containing a lot of data. To fully sign the transaction, you will be asked to confirm {signProgress.steps} times.<br />
                        Progress: {signProgress.step}/{signProgress.steps}
                    </span>
                );
            }
        };
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Status type="warning">
                        {paired === false && t('warning.sendPairing')}
                    </Status>
                    <Header sidebar={sidebar} guide={guide}>
                        <Balance
                            t={t}
                            code={code}
                            name={account.name}
                            balance={balance}
                            guide={guide}
                            fiat={fiat} />
                        <ButtonGroup guide={guide} />
                    </Header>
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            {
                                coinControl ? (
                                    <UTXOs
                                        ref={ref => this.utxos = ref}
                                        fiat={fiat}
                                        accountCode={account.code}
                                        onChange={this.onSelectedUTXOsChange}>
                                        <div class="subHeader">
                                            <h3>{t('send.title')}</h3>
                                        </div>
                                    </UTXOs>
                                ) : (
                                    <div class="row">
                                        <div class="subHeaderContainer first">
                                            <div class="subHeader">
                                                <h3>{t('send.title')}</h3>
                                            </div>
                                        </div>
                                    </div>
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
                                    autofocus
                                />
                                { debug && (
                                    <span id="sendToSelf" className={style.action} onClick={this.sendToSelf}>
                                        {t('send.toSelf')}
                                    </span>
                                ) }
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
                                        value={proposedFee ? proposedFee.amount + ' ' + proposedFee.unit + (proposedFee.conversions ? ' = ' + proposedFee.conversions[fiatUnit] + ' ' + fiatUnit : '') : null}
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
                                <p class={style.feeDescription}>{t('send.feeTarget.description.' + (feeTarget || 'loading'))}</p>
                            </div>
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
                                prequel={confirmPrequel()}
                                paired={paired}
                                signConfirm={signConfirm}
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
                                                {' '}
                                                ({feeTarget})
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
                                        !this.selectedUTXOs.length === 0 && (
                                            <div class={style.block}>
                                                <p class={['label', style.confirmationLabel].join(' ')}>
                                                    {t('send.confirm.selected_coins')}
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
                                                    proposedTotal && proposedTotal.conversions && (
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
                <Guide guide={guide} screen="send" />
            </div>
        );
    }
}
