import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiPost } from '../../../utils/request';
import { Button, Checkbox, Input, Label } from '../../../components/forms';
import WaitDialog from '../../../components/wait-dialog/wait-dialog';
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
        sendAll: false,
        isConfirming: false,
        isSent: false,
    }

    send = () => {
        this.setState({ isConfirming: true });
        apiPost('wallet/' + this.props.walletCode + '/sendtx', this.txInput()).then(res => {
            if (res.success) {
                this.setState({
                    isConfirming: false,
                    isSent: true,
                    recipientAddress: null,
                    proposedAmount: null,
                    proposedFee: null,
                    amount: null,
                });
            } else {
                this.setState({
                    isConfirming: false,
                });
            }
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
        this.setState({ proposedFee: null });
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
                alert(result.errMsg);
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
        walletCode,
        walletInitialized,
        unit,
    }, {
        proposedFee,
        recipientAddress,
        proposedAmount,
        valid,
        amount,
        sendAll,
        feeTarget,
        isConfirming,
        isSent,
    }) {
        const strippedFee = proposedFee ? proposedFee.split(' ')[0] : null;
        const totalAmount = (amount && proposedFee) ? (parseFloat(amount) + parseFloat(strippedFee)).toFixed(strippedFee.length - 2) : 'N/A';
        return (
            <div class="container">
                <div class="headerContainer">
                    <div class="header">
                        <h2>{t('send.title')}</h2>
                    </div>
                </div>
                <div class="innerContainer">
                    <div class="content">
                        <div class="row">
                            <Input
                                label={t('send.address.label')}
                                placeholder={t('send.address.placeholder')}
                                id="recipientAddress"
                                onInput={this.handleFormChange}
                                onChange={this.validateAndDisplayFee}
                                value={recipientAddress}
                                autofocus />
                        </div>
                        <div class="row">
                            <div class="flex flex-row flex-between flex-items-center">
                                <Label for="amount">{t('send.amount.label')}</Label>
                                <Checkbox
                                    label={t('send.maximum')}
                                    id="sendAll"
                                    onChange={this.sendAll}
                                    checked={sendAll} />
                            </div>
                            <Input
                                id="amount"
                                onInput={this.handleFormChange}
                                onChange={this.validateAndDisplayFee}
                                disabled={sendAll}
                                value={sendAll ? proposedAmount : amount}
                                placeholder={t('send.amount.placeholder')} />
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
                    <div class={[componentStyle.buttons, 'content', 'flex', 'flex-row', 'flex-end', 'flex-none'].join(' ')}>
                        <Button secondary onClick={this.props.onClose}>
                            {t('button.cancel')}
                        </Button>
                        &nbsp;
                        <Button primary onClick={this.send} disabled={this.sendDisabled() || !valid}>
                            {t('button.send')}
                        </Button>
                    </div>
                    <WaitDialog
                        active={isConfirming}
                        title="Confirm Transaction">
                        <p class={['label', style.confirmationLabel].join(' ')}>On your device</p>
                        <div class={['flex', 'flex-row', 'flex-around', 'flex-items-end', style.confirmationInstructions].join(' ')}>
                            <div class="flex flex-column flex-center flex-items-center">
                                <div class={style.shortTouch}></div>
                                <p class="text-bold">Tap to <span class="text-red">abort</span></p>
                            </div>
                            <div class="flex flex-column flex-center flex-items-center">
                                <div class={style.longTouch}></div>
                                <p class="text-bold">Hold 3+ secs to <span class="text-green">confirm</span></p>
                            </div>
                        </div>
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
                    <Toast
                        trigger={isSent}
                        theme="success"
                        message="Your transaction was successful."
                        onHide={() => this.setState({ isSent: false })}
                    />
                </div>
            </div>
        );
    }
}
