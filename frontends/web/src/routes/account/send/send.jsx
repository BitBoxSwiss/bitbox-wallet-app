import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiPost } from '../../../utils/request';
import { Button, Checkbox, Input, Label } from '../../../components/forms';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
import Balance from '../../../components/balance/balance';
import FeeTargets from './feetargets';
import Toast from '../../../components/toast/Toast';
import componentStyle from '../../../components/style.css';
import style from './send.css';

@translate()
export default class Send extends Component {
    state = {
        feeTarget: null,
        proposedFee: null,
        proposedAmount: null,
        valid: false,
        addressError: null,
        amountError: null,
        sendAll: false,
        isSent: false,
    }

    send = () => {
        this.props.setConfirmation({ isConfirming: true });
        apiPost('wallet/' + this.props.walletCode + '/sendtx', this.txInput()).then(res => {
            if (res.success) {
                this.setState({
                    isSent: true,
                    recipientAddress: null,
                    proposedAmount: null,
                    proposedFee: null,
                    amount: null,
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

    validateAndDisplayFee = () => {
        this.setState({
            proposedFee: null,
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
                });
            } else {
                const error = result.errMsg;
                switch (error) {
                    case 'invalid address':
                        this.setState({ addressError: error });
                        break;
                    case 'invalid amount':
                        this.setState({ amountError: error});
                        break;
                    default:
                        alert(error);
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
        }
        this.setState({
            [event.target.id]: value,
            proposedFee: null,
        });
    }

    sendAll = event => {
        this.handleFormChange(event);
        this.validateAndDisplayFee();
    }

    feeTargetChange = feeTarget => {
        this.setState({ feeTarget });
        this.validateAndDisplayFee();
    }

    render({
        t,
        wallet,
        walletCode,
        walletInitialized,
        unit,
        isConfirming,
        balance,
    }, {
        proposedFee,
        recipientAddress,
        proposedAmount,
        valid,
        amount,
        sendAll,
        feeTarget,
        isSent,
        addressError,
        amountError,
    }) {
        const strippedFee = proposedFee ? proposedFee.split(' ')[0] : null;
        const totalAmount = (amount && proposedFee) ? (parseFloat(amount) + parseFloat(strippedFee)).toFixed(strippedFee.length - 2) : 'N/A';
        return (
            <div class="container">
                <div class="headerContainer">
                    <div class="header">
                        <Balance name={wallet.name} balance={balance}>
                            {
                                balance && balance.hasIncoming && (
                                    <h5 class={style.pendingBalance}>
                                        {balance.incoming}
                                        <span style="color: var(--color-light);">{balance.unit}</span>
                                        {' '}
                                        {t('account.incoming')}
                                    </h5>
                                )
                            }
                        </Balance>
                    </div>
                </div>
                <div class="innerContainer">
                    <div class="content">
                        <div class="row">
                            <div class="subHeaderContainer">
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
                                onChange={this.validateAndDisplayFee}
                                value={recipientAddress}
                                autofocus
                            />
                        </div>
                        <div class="row">
                            <Input
                                label={t('send.amount.label')}
                                id="amount"
                                onInput={this.handleFormChange}
                                onChange={this.validateAndDisplayFee}
                                disabled={sendAll}
                                error={amountError}
                                value={sendAll ? proposedAmount : amount}
                                placeholder={t('send.amount.placeholder') + ' [' + unit + ']'}>
                                <Checkbox
                                    label={t('send.maximum')}
                                    id="sendAll"
                                    onChange={this.sendAll}
                                    checked={sendAll}
                                    className={style.maxAmount}
                                />
                            </Input>
                        </div>
                        <div class="row">
                            <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                <Input
                                    label={t('send.fee.label')}
                                    value={proposedFee ? proposedFee : null}
                                    placeholder={feeTarget === 'custom' ? t('send.fee.customPlaceholder') : t('send.fee.placeholder')}
                                    disabled={feeTarget !==  'custom'}
                                />
                                <Input
                                    label={t('send.customFee.label')}
                                    placeholder={t('send.customFee.placeholder')}
                                    disabled
                                />
                                <FeeTargets
                                    label={t('send.feeTarget.label')}
                                    placeholder={t('send.feeTarget.placeholder')}
                                    walletCode={walletCode}
                                    disabled={!amount && !sendAll}
                                    walletInitialized={walletInitialized}
                                    onFeeTargetChange={this.feeTargetChange}
                                />
                            </div>
                        </div>
                    </div>
                    <div class={[componentStyle.buttons, 'flex', 'flex-row', 'flex-end'].join(' ')}>
                        <Button secondary onClick={this.props.onClose}>
                            {t('button.cancel')}
                        </Button>
                        &nbsp;
                        <Button primary onClick={this.send} disabled={this.sendDisabled() || !valid}>
                            {t('button.send')}
                        </Button>
                    </div>
                    {
                        isConfirming && (
                            <WaitDialog title="Confirm Transaction" includeDefault>
                                <div class={style.confirmationBox}>
                                    <p class={['label', style.confirmationLabel].join(' ')}>Address</p>
                                    <p class={style.confirmationValue}>{recipientAddress || 'N/A'}</p>
                                    <div class="flex flex-row flex-start has-gutter">
                                        <div>
                                            <p class={['label', style.confirmationLabel].join(' ')}>Amount</p>
                                            <p class={style.confirmationValue}>{amount || 'N/A'} {unit}</p>
                                        </div>
                                        <div>
                                            <p class={['label', style.confirmationLabel].join(' ')}>Network Fee ({feeTarget})</p>
                                            <p class={style.confirmationValue}>{proposedFee || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <p class={['label', style.confirmationLabel].join(' ')}>Total</p>
                                    <p class={[style.confirmationValue, style.standOut].join(' ')}>{totalAmount || 'N/A'} {unit}</p>
                                </div>
                            </WaitDialog>
                        )
                    }
                    {
                        isSent && (
                            <Toast
                                theme="success"
                                message="Your transaction was successful."
                                onHide={() => this.setState({ isSent: false })}
                            />
                        )
                    }
                </div>
            </div>
        );
    }
}
