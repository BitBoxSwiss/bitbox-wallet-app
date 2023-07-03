/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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

import React, { Component } from 'react';
import { BrowserQRCodeReader } from '@zxing/library';
import * as accountApi from '../../../api/account';
import { syncdone } from '../../../api/accountsync';
import { BtcUnit, parseExternalBtcAmount } from '../../../api/coins';
import { View, ViewContent } from '../../../components/view/view';
import { TDevices } from '../../../api/devices';
import { getDeviceInfo } from '../../../api/bitbox01';
import qrcodeIconDark from '../../../assets/icons/qrcode-dark.png';
import qrcodeIconLight from '../../../assets/icons/qrcode-light.png';
import { alertUser } from '../../../components/alert/Alert';
import A from '../../../components/anchor/anchor';
import { Balance } from '../../../components/balance/balance';
import { Button, ButtonLink, Checkbox, Input } from '../../../components/forms';
import { Column, ColumnButtons, Grid, GuideWrapper, GuidedContent, Header, Main } from '../../../components/layout';
import { store as fiat } from '../../../components/rates/rates';
import { Status } from '../../../components/status/status';
import { translate, TranslateProps } from '../../../decorators/translate';
import { debug } from '../../../utils/env';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { isBitcoinBased, findAccount } from '../utils';
import { FeeTargets } from './feetargets';
import { TSelectedUTXOs, UTXOs } from './utxos';
import { route } from '../../../utils/route';
import { UnsubscribeList, unsubscribe } from '../../../utils/subscriptions';
import { ConfirmingWaitDialog } from './components/dialogs/confirm-wait-dialog';
import { MessageWaitDialog } from './components/dialogs/message-wait-dialog';
import style from './send.module.css';
import DialogScanQR from './components/dialogs/scan-qr-dialog';


interface SendProps {
    accounts: accountApi.IAccount[];
    code: string;
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
    btcUnit: BtcUnit;
    activeCoinControl: boolean;
    hasCamera: boolean;
    activeScanQR: boolean;
    videoLoading: boolean;
    note: string;
}

class Send extends Component<Props, State> {
  private selectedUTXOs: TSelectedUTXOs = {};
  private unsubscribeList: UnsubscribeList = [];
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
    btcUnit : 'default',
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
  };

  public componentDidMount() {
    if (this.props.code) {
      accountApi.getBalance(this.props.code)
        .then(balance => this.setState({ balance }))
        .catch(console.error);
    }
    if (this.props.deviceIDs.length > 0 && this.props.devices[this.props.deviceIDs[0]] === 'bitbox') {
      apiGet('devices/' + this.props.deviceIDs[0] + '/has-mobile-channel').then((mobileChannel: boolean) => {
        getDeviceInfo(this.props.deviceIDs[0])
          .then(({ pairing }) => {
            const account = this.getAccount();
            const paired = mobileChannel && pairing;
            const noMobileChannelError = pairing && !mobileChannel && account && isBitcoinBased(account.coinCode);
            this.setState(prevState => ({ ...prevState, paired, noMobileChannelError }));
          });
      });
    }
    apiGet('config').then(config => {
      this.setState({ btcUnit: config.backend.btcUnit });
      if (this.isBitcoinBased()) {
        this.setState({ coinControl: !!(config.frontend || {}).coinControl });
      }
    });

    this.unsubscribeList = [
      apiWebsocket((payload) => {
        if ('type' in payload) {
          const { data, meta, type } = payload;
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
        }
      }),
      syncdone(this.props.code, (code) => {
        accountApi.getBalance(code)
          .then(balance => this.setState({ balance }))
          .catch(console.error);
      }),
    ];
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
    unsubscribe(this.unsubscribeList);
    if (this.qrCodeReader) {
      this.qrCodeReader.reset();
    }
  }

  private registerEvents = () => {
    document.addEventListener('keydown', this.handleKeyDown);
  };

  private unregisterEvents = () => {
    document.removeEventListener('keydown', this.handleKeyDown);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.keyCode === 27 && !this.state.activeCoinControl && !this.state.activeScanQR) {
      route(`/account/${this.props.code}`);
    }
  };

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
        this.selectedUTXOs = {};
        setTimeout(() => this.setState({
          isSent: false,
          isConfirming: false,
        }), 5000);
      } else if (result.aborted) {
        this.setState({ isAborted: true });
        setTimeout(() => this.setState({ isAborted: false }), 5000);
      } else {
        switch (result.errorCode) {
        case 'erc20InsufficientGasFunds':
          alertUser(this.props.t(`send.error.${result.errorCode}`));
          break;
        default:
          const { errorMessage } = result;
          alertUser(this.props.t('unknownError', errorMessage && { errorMessage }));
        }
      }
    })
      .catch((error) => console.error(error))
      .then(() => {
        // The following method allows pressing escape again.
        this.setState({ isConfirming: false, signProgress: undefined, signConfirm: false });
      });
  };

  private txInput = () => ({
    address: this.state.recipientAddress,
    amount: this.state.amount,
    feeTarget: this.state.feeTarget || '',
    customFee: this.state.customFee,
    sendAll: this.state.sendAll ? 'yes' : 'no',
    selectedUTXOs: Object.keys(this.selectedUTXOs),
  });

  private sendDisabled = () => {
    const txInput = this.txInput();
    return !txInput.address || this.state.feeTarget === undefined || (txInput.sendAll === 'no' && !txInput.amount) || (this.state.feeTarget === 'custom' && !this.state.customFee);
  };

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
  };

  private handleNoteInput = (event: Event) => {
    const target = (event.target as HTMLInputElement);
    this.setState({
      'note': target.value,
    }, () => {
      apiPost('account/' + this.getAccount()!.code + '/propose-tx-note', this.state.note);
    });
  };

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
  };

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
  };

  private handleFiatInput = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    this.setState({ fiatAmount: value });
    this.convertFromFiat(value);
  };

  private convertToFiat = (value?: string | boolean) => {
    if (value) {
      const coinCode = this.getAccount()!.coinCode;
      apiGet(`coins/convert-to-plain-fiat?from=${coinCode}&to=${this.state.fiatUnit}&amount=${value}`)
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
  };

  private convertFromFiat = (value: string) => {
    if (value) {
      const coinCode = this.getAccount()!.coinCode;
      apiGet(`coins/convert-from-fiat?from=${this.state.fiatUnit}&to=${coinCode}&amount=${value}`)
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
  };

  private sendToSelf = (event: React.SyntheticEvent) => {
    accountApi.getReceiveAddressList(this.getAccount()!.code)()
      .then(receiveAddresses => {
        if (receiveAddresses && receiveAddresses.length > 0 && receiveAddresses[0].addresses.length > 1) {
          this.setState({ recipientAddress: receiveAddresses[0].addresses[0].address });
          this.handleFormChange(event);
        }
      })
      .catch(console.error);
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

  private getAccount = (): accountApi.IAccount | undefined => {
    if (!this.props.code) {
      return undefined;
    }
    return findAccount(this.props.accounts, this.props.code);
  };

  private toggleCoinControl = () => {
    this.setState(({ activeCoinControl }) => {
      if (activeCoinControl) {
        this.selectedUTXOs = {};
      }
      return { activeCoinControl: !activeCoinControl };
    });
  };

  private async parseQRResult(uri: string) {
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

    const coinCode = this.getAccount()!.coinCode;
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
  };

  private deactivateCoinControl = () => {
    this.setState({ activeCoinControl: false });
  };

  private handleVideoLoad = () => {
    this.setState({ videoLoading: false });
  };

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
      btcUnit,
      activeCoinControl,
      hasCamera,
      activeScanQR,
      videoLoading,
      note,
    } = this.state;

    const waitDialogTransactionDetails = {
      proposedFee,
      proposedAmount,
      proposedTotal,
      customFee,
      feeTarget,
      recipientAddress,
      fiatUnit,
    };

    const waitDialogTransactionStatus = {
      isConfirming,
      signProgress,
      signConfirm
    };

    const account = this.getAccount();
    if (!account) {
      return null;
    }

    const baseCurrencyUnit: accountApi.ConversionUnit = fiatUnit === 'BTC' && btcUnit === 'sat' ? 'sat' : fiatUnit;
    return (
      <GuideWrapper>
        <GuidedContent>
          <Main>
            <Status type="warning" hidden={paired !== false}>
              {t('warning.sendPairing')}
            </Status>
            <Header
              title={<h2>{t('send.title', { accountName: account.coinName })}</h2>}
            />
            <View>
              <ViewContent>
                <div>
                  <label className="labelXLarge">{t('send.availableBalance')}</label>
                </div>
                <Balance balance={balance} noRotateFiat/>
                { coinControl && (
                  <UTXOs
                    accountCode={account.code}
                    active={activeCoinControl}
                    explorerURL={account.blockExplorerTxPrefix}
                    onClose={this.deactivateCoinControl}
                    onChange={this.onSelectedUTXOsChange} />
                ) }
                <div className={`flex flex-row flex-between ${style.container}`}>
                  <label className="labelXLarge">{t('send.transactionDetails')}</label>
                  { coinControl && (
                    <A href="#" onClick={this.toggleCoinControl} className="labelLarge labelLink">{t('send.toggleCoinControl')}</A>
                  )}
                </div>
                <Grid col="1">
                  <Column>
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
                      { hasCamera && (
                        <button onClick={this.toggleScanQR} className={style.qrButton}>
                          <img className="show-in-lightmode" src={qrcodeIconDark} />
                          <img className="show-in-darkmode" src={qrcodeIconLight} />
                        </button>
                      )}
                    </Input>
                  </Column>
                </Grid>
                <Grid>
                  <Column>
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
                  </Column>
                  <Column>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      label={baseCurrencyUnit}
                      id="fiatAmount"
                      onInput={this.handleFiatInput}
                      disabled={sendAll}
                      error={amountError}
                      value={fiatAmount}
                      placeholder={t('send.amount.placeholder')} />
                  </Column>
                </Grid>
                <Grid>
                  <Column>
                    <FeeTargets
                      accountCode={account.code}
                      coinCode={account.coinCode}
                      disabled={!amount && !sendAll}
                      fiatUnit={baseCurrencyUnit}
                      proposedFee={proposedFee}
                      customFee={customFee}
                      showCalculatingFeeLabel={isUpdatingProposal}
                      onFeeTargetChange={this.feeTargetChange}
                      onCustomFee={customFee => this.setState({ customFee }, this.validateAndDisplayFee)}
                      error={feeError} />
                  </Column>
                  <Column>
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
                    <ColumnButtons
                      className="m-top-default m-bottom-xlarge"
                      inline>
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
                    </ColumnButtons>
                  </Column>
                </Grid>
              </ViewContent>
              <ConfirmingWaitDialog
                paired={paired}
                baseCurrencyUnit={baseCurrencyUnit}
                note={note}
                hasSelectedUTXOs={this.hasSelectedUTXOs()}
                selectedUTXOs={Object.keys(this.selectedUTXOs)}
                coinCode={account.coinCode}
                transactionDetails={waitDialogTransactionDetails}
                transactionStatus={waitDialogTransactionStatus}
              />
              <MessageWaitDialog isShown={isSent} messageType={'sent'} />
              <MessageWaitDialog isShown={isAborted} messageType={'abort'} />
              <DialogScanQR
                activeScanQR={activeScanQR}
                onLoadedVideo={this.handleVideoLoad}
                toggleScanQR={this.toggleScanQR}
                videoLoading={videoLoading}
              />
            </View>
          </Main>
        </GuidedContent>
      </GuideWrapper>

    );
  }
}

const TranslatedSend = translate()(Send);
export { TranslatedSend as Send };
