import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { debug } from '../../../utils/env';
import { Button, Checkbox, Input } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import Status from '../../../components/status/status';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import Balance from '../../../components/balance/balance';
import FeeTargets from './feetargets';
import Toast from '../../../components/toast/Toast';
import style from './send.css';

@translate()
export default class Send extends Component {

    constructor(props) {
        super(props);

        let coinUnitForConversion = props.wallet.coinCode.toUpperCase();
        if (coinUnitForConversion.length === 4 && coinUnitForConversion.startsWith('T')) {
            coinUnitForConversion = coinUnitForConversion.substring(1);
        }

        this.state = {
            feeTarget: null,
            proposedFee: null,
            proposedAmount: null,
            proposedTotal: null,
            valid: false,
            addressError: null,
            amountError: null,
            sendAll: false,
            isSent: false,
            paired: null,
            fiatAmount: null,
            fiatUnit: props.fiat.code,
            coinUnitForConversion,
            signProgress: null,
        };
    }

    componentDidMount() {
        if (this.props.deviceIDs.length > 0) {
            apiGet('devices/' + this.props.deviceIDs[0] + '/paired').then((paired) => {
                this.setState({ paired });
            });
        }

        this.unsubscribe = apiWebsocket(({ type, data, meta }) => {
            switch (type) {
            case 'device':
                switch (data) {
                case 'signProgress':
                    this.setState({ signProgress: meta });
                    break;
                }
                break;
            }
        });
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    send = () => {
        this.setState({ signProgress: null });
        this.props.setConfirmation({ isConfirming: true });
        apiPost('wallet/' + this.props.walletCode + '/sendtx', this.txInput()).then(res => {
            if (res.success) {
                this.setState({
                    isSent: true,
                    recipientAddress: null,
                    proposedAmount: null,
                    proposedFee: null,
                    proposedTotal: null,
                    amount: null,
                    signProgress: null,
                });
            }
            this.props.setConfirmation({ isConfirming: false });
        }).catch(() => {
            this.props.setConfirmation({ isConfirming: false });
        });
    }

    txInput = () => ({
        address: this.state.recipientAddress,
        amount: this.state.amount,
        feeTarget: this.state.feeTarget,
        sendAll: this.state.sendAll ? 'yes' : 'no',
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
        apiPost('wallet/' + this.props.walletCode + '/tx-proposal', txInput).then(result => {
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
                        /* eslint no-alert: 0 */
                        alert(error);
                    }
                }
            }
        }).catch(() => {
            this.setState({ valid: false });
        });
    }

    handleFormChange = event => {
        let value = event.target.value;
        if (event.target.id === 'sendAll') {
            value = event.target.checked;
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
            apiGet(`coins/convertToFiat?from=${this.state.coinUnitForConversion}&to=${this.state.fiatUnit}&amount=${value}`)
                .then(data => {
                    if (data.success) {
                        this.setState({ fiatAmount: data.fiatAmount });
                    } else {
                        this.setState({ amountError: "invalid amount" });
                    }
                });
        } else {
            this.setState({ fiatAmount: null });
        }
    }

    convertFromFiat = value => {
        if (value) {
            apiGet(`coins/convertFromFiat?from=${this.state.fiatUnit}&to=${this.state.coinUnitForConversion}&amount=${value}`)
                .then(data => {
                    if (data.success) {
                        this.setState({ amount: data.amount });
                        this.validateAndDisplayFee(false);
                    } else {
                        this.setState({ amountError: "invalid amount" });
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
        apiGet('wallet/' + this.props.walletCode + '/receive-addresses').then(receiveAddresses => {
            this.setState({ recipientAddress: receiveAddresses[0].address });
        });
    }

    feeTargetChange = feeTarget => {
        this.setState({ feeTarget });
        this.validateAndDisplayFee(this.state.sendAll);
    }

    render({
        t,
        wallet,
        walletCode,
        walletInitialized,
        unit,
        isConfirming,
        balance,
        guide,
        fiat,
    }, {
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
        isSent,
        addressError,
        amountError,
        paired,
        signProgress,
    }) {
        let confirmPrequel = () => {
            if (signProgress) {
                return (
                    <span>
                      This is a transaction containing a lot of data. To fully sign the transaction, you will be asked to confirm {signProgress.steps} times. <br/>
                      Progress: {signProgress.step}/{signProgress.steps}
                    </span>
                );
            }
        };
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <div class="headerContainer">
                        <Status type="warning">
                            {paired === false && t('warning.sendPairing')}
                        </Status>
                        <div class="header">
                            <Balance t={t} name={wallet.name} balance={balance} fiat={fiat} />
                        </div>
                    </div>
                    <div class="innerContainer">
                        <div class="content padded">
                            <div class="row">
                                <div class="subHeaderContainer first">
                                    <div class="subHeader">
                                        <h3>{t('send.title')}</h3>
                                    </div>
                                </div>
                            </div>
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
                                { debug && <span className={style.action} onClick={this.sendToSelf}>{t('send.toSelf')}</span> }
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
                                        placeholder={`${t('send.amount.placeholder')} (${unit})`} />
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
                                        walletCode={walletCode}
                                        disabled={!amount && !sendAll}
                                        walletInitialized={walletInitialized}
                                        onFeeTargetChange={this.feeTargetChange}
                                    />
                                    <Input
                                        label={t('send.fee.label')}
                                        value={proposedFee ? proposedFee.amount + ' ' + proposedFee.unit + (proposedFee.conversions ? ' = ' + proposedFee.conversions[fiatUnit] + ' ' + fiatUnit : '') : null}
                                        placeholder={feeTarget === 'custom' ? t('send.fee.customPlaceholder') : t('send.fee.placeholder')}
                                        disabled={feeTarget !==  'custom'}
                                    />
                                    {/*
                                    <Input
                                        label={t('send.customFee.label')}
                                        placeholder={t('send.customFee.placeholder')}
                                        disabled
                                    />
                                    */}
                                </div>
                                <p class={style.feeDescription}>{t('send.feeTarget.description.' + feeTarget)}</p>
                            </div>
                            <div class={['row', 'buttons', 'flex', 'flex-row', 'flex-between', 'flex-start'].join(' ')}>
                                <Button secondary onClick={this.props.onClose}>
                                    {t('button.back')}
                                </Button>
                                <Button primary onClick={this.send} disabled={this.sendDisabled() || !valid}>
                                    {t('button.send')}
                                </Button>
                            </div>
                        </div>
                    </div>
                    {
                        isConfirming && (
                            <WaitDialog title={t('send.confirm.title')} includeDefault prequel={confirmPrequel()}>
                                <div class={style.confirmationBox}>
                                    <div class="row">
                                        <p class={['label', style.confirmationLabel, 'first'].join(' ')}>
                                            {t('send.address.label')}
                                        </p>
                                        <p class={style.confirmationValue}>{recipientAddress || 'N/A'}</p>
                                    </div>
                                    <div class="flex flex-row flex-start spaced">
                                        <div>
                                            <p class={['label', style.confirmationLabel].join(' ')}>
                                                {t('send.amount.label')}
                                            </p>
                                            <p class={style.confirmationValue}>{proposedAmount && proposedAmount.amount + ' ' + proposedAmount.unit || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p class={['label', style.confirmationLabel].join(' ')}>
                                                {t('send.fee.label')}
                                                ({feeTarget})
                                            </p>
                                            <p class={style.confirmationValue}>{proposedFee && proposedFee.amount + ' ' + proposedFee.unit || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <p class={['label', style.confirmationLabel].join(' ')}>
                                        {t('send.total.label')}
                                    </p>
                                    <p class={[style.confirmationValue, style.standOut].join(' ')}>{proposedTotal && proposedTotal.amount + ' ' + proposedTotal.unit || 'N/A'}</p>
                                </div>
                            </WaitDialog>
                        )
                    }
                    {
                        isSent && (
                            <Toast
                                theme="success"
                                message={t('send.success')}
                                withGuide={guide.shown}
                                onHide={() => this.setState({ isSent: false })}
                            />
                        )
                    }
                </div>
                <Guide guide={guide} screen="send" />
            </div>
        );
    }
}
