/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023-2024 Shift Crypto AG
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

import { ChangeEvent, Component } from 'react';
import * as accountApi from '@/api/account';
import { syncdone } from '@/api/accountsync';
import { convertFromCurrency, convertToCurrency, parseExternalBtcAmount } from '@/api/coins';
import { View, ViewContent } from '@/components/view/view';
import { alertUser } from '@/components/alert/Alert';
import { Balance } from '@/components/balance/balance';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Column, ColumnButtons, Grid, GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { translate, TranslateProps } from '@/decorators/translate';
import { FeeTargets } from './feetargets';
import { isBitcoinBased } from '@/routes/account/utils';
import { ConfirmSend } from './components/confirm/confirm';
import { SendGuide } from './send-guide';
import { MessageWaitDialog } from './components/dialogs/message-wait-dialog';
import { ReceiverAddressInput } from './components/inputs/receiver-address-input';
import { CoinInput } from './components/inputs/coin-input';
import { FiatInput } from './components/inputs/fiat-input';
import { NoteInput } from './components/inputs/note-input';
import { TSelectedUTXOs } from './utxos';
import { TProposalError, txProposalErrorHandling } from './services';
import { CoinControl } from './coin-control';
import style from './send.module.css';

interface SendProps {
    account: accountApi.IAccount;
    // undefined if bb02 is connected.
    bb01Paired: boolean | undefined;
    activeCurrency: accountApi.Fiat;
}

type Props = SendProps & TranslateProps;

export type State = {
    balance?: accountApi.IBalance;
    proposedFee?: accountApi.IAmount;
    proposedTotal?: accountApi.IAmount;
    recipientAddress: string;
    proposedAmount?: accountApi.IAmount;
    valid: boolean;
    amount: string;
    fiatAmount: string;
    sendAll: boolean;
    feeTarget?: accountApi.FeeTargetCode;
    customFee: string;
    isConfirming: boolean;
    sendResult?: accountApi.ISendTx;
    isUpdatingProposal: boolean;
    addressError?: TProposalError['addressError'];
    amountError?: TProposalError['amountError'];
    feeError?: TProposalError['feeError'];
    note: string;
}

class Send extends Component<Props, State> {
  private selectedUTXOs: TSelectedUTXOs = {};
  private unsubscribe?: () => void;

  // in case there are multiple parallel tx proposals we can ignore all other but the last one
  private lastProposal: Promise<accountApi.TTxProposalResult> | null = null;
  private proposeTimeout: ReturnType<typeof setTimeout> | null = null;

  public readonly state: State = {
    recipientAddress: '',
    amount: '',
    fiatAmount: '',
    valid: false,
    sendAll: false,
    isConfirming: false,
    isUpdatingProposal: false,
    note: '',
    customFee: '',
  };

  public componentDidMount() {
    const updateBalance = (code: string) => accountApi.getBalance(code)
      .then(balance => this.setState({ balance }))
      .catch(console.error);

    updateBalance(this.props.account.code);

    this.unsubscribe = syncdone((code) => {
      if (this.props.account.code === code) {
        updateBalance(code);
      }
    });
  }

  public componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private send = async () => {
    const code = this.props.account.code;
    const connectResult = await accountApi.connectKeystore(code);
    if (!connectResult.success) {
      return;
    }

    this.setState({ isConfirming: true });
    try {
      const result = await accountApi.sendTx(code, this.state.note);
      this.setState({ sendResult: result, isConfirming: false });
      setTimeout(() => this.setState({ sendResult: undefined }), 5000);
      if (result.success) {
        this.setState({
          sendAll: false,
          isConfirming: false,
          recipientAddress: '',
          proposedAmount: undefined,
          proposedFee: undefined,
          proposedTotal: undefined,
          fiatAmount: '',
          amount: '',
          note: '',
          customFee: '',
        });
        this.selectedUTXOs = {};
      }
    } catch (err) {
      console.error(err);
    } finally {
      // The following method allows pressing escape again.
      this.setState({ isConfirming: false, });
    }
  };

  private getValidTxInputData = (): Required<accountApi.TTxInput> | false => {
    if (
      !this.state.recipientAddress
      || this.state.feeTarget === undefined
      || (!this.state.sendAll && !this.state.amount)
      || (this.state.feeTarget === 'custom' && !this.state.customFee)
    ) {
      return false;
    }
    return {
      address: this.state.recipientAddress,
      amount: this.state.amount,
      feeTarget: this.state.feeTarget,
      customFee: this.state.customFee,
      sendAll: (this.state.sendAll ? 'yes' : 'no'),
      selectedUTXOs: Object.keys(this.selectedUTXOs),
      paymentRequest: null,
    };
  };

  private validateAndDisplayFee = (updateFiat: boolean = true) => {
    this.setState({
      proposedTotal: undefined,
      addressError: undefined,
      amountError: undefined,
      feeError: undefined,
    });
    const txInput = this.getValidTxInputData();
    if (!txInput) {
      return;
    }
    if (this.proposeTimeout) {
      clearTimeout(this.proposeTimeout);
      this.proposeTimeout = null;
    }
    this.setState({ isUpdatingProposal: true });
    // defer the transaction proposal
    this.proposeTimeout = setTimeout(async () => {
      const proposePromise = accountApi.proposeTx(this.props.account.code, txInput);
      // keep this as the last known proposal
      this.lastProposal = proposePromise;
      try {
        const result = await proposePromise;
        // continue only if this is the most recent proposal
        if (proposePromise === this.lastProposal) {
          this.txProposal(updateFiat, result);
        }
      } catch (error) {
        this.setState({ valid: false });
        console.error('Failed to propose transaction:', error);
      } finally {
        // cleanup regardless of success or failure
        if (proposePromise === this.lastProposal) {
          this.lastProposal = null;
        }
      }
    }, 400); // Delay the proposal by 400 ms
  };

  private handleNoteInput = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    this.setState({
      'note': target.value,
    });
  };

  private txProposal = (
    updateFiat: boolean,
    result: accountApi.TTxProposalResult,
  ) => {
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
      const errorHandling = txProposalErrorHandling(result.errorCode);
      this.setState({ ...errorHandling, isUpdatingProposal: false });
    }
  };

  private handleFiatInput = (fiatAmount: string) => {
    this.setState({ fiatAmount });
    this.convertFromFiat(fiatAmount);
  };

  private convertToFiat = async (amount: string) => {
    if (amount) {
      const coinCode = this.props.account.coinCode;
      const data = await convertToCurrency({
        amount,
        coinCode,
        fiatUnit: this.props.activeCurrency,
      });
      if (data.success) {
        this.setState({ fiatAmount: data.fiatAmount });
      } else {
        this.setState({ amountError: this.props.t('send.error.invalidAmount') });
      }
    } else {
      this.setState({ fiatAmount: '' });
    }
  };

  private convertFromFiat = async (amount: string) => {
    if (amount) {
      const coinCode = this.props.account.coinCode;
      const data = await convertFromCurrency({
        amount,
        coinCode,
        fiatUnit: this.props.activeCurrency,
      });
      if (data.success) {
        this.setState({ amount: data.amount }, () => this.validateAndDisplayFee(false));
      } else {
        this.setState({ amountError: this.props.t('send.error.invalidAmount') });
      }
    } else {
      this.setState({ amount: '' });
    }
  };

  private feeTargetChange = (feeTarget: accountApi.FeeTargetCode) => {
    this.setState(
      { feeTarget, customFee: '' },
      () => this.validateAndDisplayFee(this.state.sendAll),
    );
  };

  private onSelectedUTXOsChange = (selectedUTXOs: TSelectedUTXOs) => {
    this.selectedUTXOs = selectedUTXOs;
    this.validateAndDisplayFee(true);
  };

  private hasSelectedUTXOs = (): boolean => {
    return Object.keys(this.selectedUTXOs).length !== 0;
  };

  private parseQRResult = async (uri: string) => {
    let address;
    let amount = '';
    try {
      const url = new URL(uri);
      if (url.protocol !== 'bitcoin:' && url.protocol !== 'litecoin:' && url.protocol !== 'ethereum:') {
        alertUser(this.props.t('invalidFormat'));
        return;
      }
      address = url.pathname;
      if (isBitcoinBased(this.props.account.coinCode)) {
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

    const coinCode = this.props.account.coinCode;
    if (amount) {
      if (coinCode === 'btc' || coinCode === 'tbtc') {
        const result = await parseExternalBtcAmount(amount);
        if (result.success) {
          updateState['amount'] = result.amount;
        } else {
          updateState['amountError'] = this.props.t('send.error.invalidAmount');
          this.setState(updateState);
          return;
        }
      } else {
        updateState['amount'] = amount;
      }
    }

    this.setState(updateState, () => {
      this.convertToFiat(this.state.amount);
      this.validateAndDisplayFee(true);
    });
  };

  private onReceiverAddressInputChange = (recipientAddress: string) => {
    this.setState({ recipientAddress }, () => {
      this.validateAndDisplayFee(true);
    });
  };

  private onCoinAmountChange = (amount: string) => {
    this.convertToFiat(amount);
    this.setState({ amount }, () => {
      this.validateAndDisplayFee(true);
    });
  };

  private onSendAllChange = (sendAll: boolean) => {
    if (!sendAll) {
      this.convertToFiat(this.state.amount);
    }
    this.setState({ sendAll }, () => {
      this.validateAndDisplayFee(true);
    });
  };

  public render() {
    const {
      account,
      bb01Paired,
      activeCurrency,
      t,
    } = this.props;

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
      sendAll,
      feeTarget,
      customFee,
      isConfirming,
      sendResult,
      isUpdatingProposal,
      addressError,
      amountError,
      feeError,
      note,
    } = this.state;

    const waitDialogTransactionDetails = {
      proposedFee,
      proposedAmount,
      proposedTotal,
      customFee,
      feeTarget,
      recipientAddress,
      activeCurrency,
    };

    return (
      <GuideWrapper>
        <GuidedContent>
          <Main>
            <Header
              title={<h2>{t('send.title', { accountName: account.coinName })}</h2>}
            >
              <HideAmountsButton />
            </Header>
            <View>
              <ViewContent>
                <div>
                  <label className="labelXLarge">{t('send.availableBalance')}</label>
                </div>
                <Balance balance={balance} noRotateFiat/>
                <div className={`flex flex-row flex-between ${style.container}`}>
                  <label className="labelXLarge">{t('send.transactionDetails')}</label>
                  <CoinControl
                    account={account}
                    onSelectedUTXOsChange={this.onSelectedUTXOsChange}
                  />
                </div>
                <Grid col="1">
                  <Column>
                    <ReceiverAddressInput
                      accountCode={account.code}
                      addressError={addressError}
                      onInputChange={this.onReceiverAddressInputChange}
                      recipientAddress={recipientAddress}
                      parseQRResult={this.parseQRResult}
                    />
                  </Column>
                </Grid>
                <Grid>
                  <Column>
                    <CoinInput
                      balance={balance}
                      onAmountChange={this.onCoinAmountChange}
                      onSendAllChange={this.onSendAllChange}
                      sendAll={sendAll}
                      amountError={amountError}
                      proposedAmount={proposedAmount}
                      amount={amount}
                      hasSelectedUTXOs={this.hasSelectedUTXOs()}
                    />
                  </Column>
                  <Column>
                    <FiatInput
                      onFiatChange={this.handleFiatInput}
                      disabled={sendAll}
                      error={amountError}
                      fiatAmount={fiatAmount}
                      label={activeCurrency}
                    />
                  </Column>
                </Grid>
                <Grid>
                  <Column>
                    <FeeTargets
                      accountCode={account.code}
                      coinCode={account.coinCode}
                      disabled={!amount && !sendAll}
                      fiatUnit={activeCurrency}
                      proposedFee={proposedFee}
                      customFee={customFee}
                      showCalculatingFeeLabel={isUpdatingProposal}
                      onFeeTargetChange={this.feeTargetChange}
                      onCustomFee={customFee => this.setState({ customFee }, this.validateAndDisplayFee)}
                      error={feeError} />
                  </Column>
                  <Column>
                    <NoteInput
                      note={note}
                      onNoteChange={this.handleNoteInput}
                    />
                    <ColumnButtons
                      className="m-top-default m-bottom-xlarge"
                      inline>
                      <Button
                        primary
                        onClick={this.send}
                        disabled={!this.getValidTxInputData() || !valid || isUpdatingProposal}>
                        {t('send.button')}
                      </Button>
                      <BackButton
                        enableEsc>
                        {t('button.back')}
                      </BackButton>
                    </ColumnButtons>
                  </Column>
                </Grid>
              </ViewContent>
              <ConfirmSend
                bb01Paired={bb01Paired}
                baseCurrencyUnit={activeCurrency}
                note={note}
                hasSelectedUTXOs={this.hasSelectedUTXOs()}
                isConfirming={isConfirming}
                selectedUTXOs={Object.keys(this.selectedUTXOs)}
                coinCode={account.coinCode}
                transactionDetails={waitDialogTransactionDetails}
              />
              <MessageWaitDialog result={sendResult}/>
            </View>
          </Main>
        </GuidedContent>
        <SendGuide coinCode={account.coinCode} />
      </GuideWrapper>

    );
  }
}

const TranslatedSend = translate()(Send);
export { TranslatedSend as Send };
