/**
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

import { useEffect, useState, useRef, useCallback } from 'react';
import { route } from '../../../utils/route';
import { ConversionUnit, FeeTargetCode, IAccount, IBalance, getBalance, getReceiveAddressList, sendTx } from '../../../api/account';
import { findAccount, isBitcoinBased } from '../utils';
import { useTranslation } from 'react-i18next';
import { alertUser } from '../../../components/alert/Alert';
import { apiGet, apiPost } from '../../../utils/request';
import { parseExternalBtcAmount } from '../../../api/coins';
import { store } from '../../../components/rates/rates';
import { TSelectedUTXOs, UTXOs } from './utxos';
import { BrowserQRCodeReader } from '@zxing/library';
import { TDevices } from '../../../api/devices';
import { getDeviceInfo } from '../../../api/bitbox01';
import { TPayload, apiWebsocket } from '../../../utils/websocket';
import { syncdone } from '../../../api/accountsync';
import { UnsubscribeList, unsubscribe } from '../../../utils/subscriptions';
import A from '../../../components/anchor/anchor';
import { Column, ColumnButtons, Grid, GuideWrapper, GuidedContent, Header, Main } from '../../../components/layout';
import { Status } from '../../../components/status/status';
import { Balance } from '../../../components/balance/balance';
import { debug } from '../../../utils/env';
import { FeeTargets } from './feetargets';
import { CameraState, ErrorHandlingState, TProposalResult, TransactionDetailsState, TransactionStatusState } from './types';
import DialogScanQR from './components/scan-qr-dialog';
import { ConfirmingWaitDialog } from './components/confirming-wait-dialog';
import SendGuide from './send-guide';
import { MessageWaitDialog } from './components/message-wait-dialog';
import { NoteInput } from './components/inputs/note-input';
import { ButtonsGroup } from './components/inputs/buttons-group';
import { FiatInput } from './components/inputs/fiat-input';
import { View, ViewContent } from '../../../components/view/view';
import { CoinInput } from './components/inputs/coin-input';
import { ReceiverAddressInput } from './components/inputs/receiver-address-input';
import style from './send.module.css';
import { useLoad } from '../../../hooks/api';
import { getConfig } from '../../../utils/config';
import { convertToFiatService } from './services';

interface SendProps {
  accounts: IAccount[];
  code: string;
  devices: TDevices;
  deviceIDs: string[];
}

export const NewSend = ({ accounts, code, deviceIDs, devices }: SendProps) => {
  const { t } = useTranslation();
  const [balance, setBalance] = useState<IBalance>();

  // Transaction Details:
  const [transactionDetails, setTransactionDetails] = useState<TransactionDetailsState>({
    recipientAddress: '',
    amount: '',
    proposedFee: undefined,
    proposedTotal: undefined,
    proposedAmount: undefined,
    valid: false,
    fiatAmount: '',
    fiatUnit: store.state.active,
    sendAll: false,
    feeTarget: undefined,
    customFee: '',
  });

  // Transaction Status:
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatusState>({
    isConfirming: false,
    isSent: false,
    isAborted: false,
    isUpdatingProposal: false,
    signProgress: undefined,
    signConfirm: false,
  });

  // Error Handling:
  const [errorHandling, setErrorHandling] = useState<ErrorHandlingState>({
    addressError: undefined,
    amountError: undefined,
    feeError: undefined,
    noMobileChannelError: undefined,
  });

  // Coin Control Dialog Settings:
  const [activeCoinControl, setActiveCoinControl] = useState(false);

  // Camera and QR Code:
  const [cameraState, setCameraState] = useState<CameraState>({
    hasCamera: false,
    activeScanQR: false,
    videoLoading: false,
  });

  const [note, setNote] = useState('');
  const [paired, setPaired] = useState<boolean>();

  const selectedUTXOs = useRef<TSelectedUTXOs>({});
  const unsubscribeList = useRef<UnsubscribeList>([]);
  const qrCodeReader = useRef<BrowserQRCodeReader>();
  const pendingProposals = useRef<any[]>([]);
  const proposeTimeout = useRef<any>(null);
  const conf = useLoad(getConfig);

  const account = findAccount(accounts, code);

  const registerEvents = () => {
    document.addEventListener('keydown', handleKeyDown);
  };

  const unregisterEvents = () => {
    document.removeEventListener('keydown', handleKeyDown);
  };

  const handleKeyDown = useCallback((e) => {
    if (e.keyCode === 27 && !activeCoinControl && !cameraState.activeScanQR) {
      route(`/account/${code}`);
    }
  }, [activeCoinControl, cameraState.activeScanQR, code]);

  const send = () => {
    if (noMobileChannelError) {
      alertUser(t('warning.sendPairing'));
      return;
    }

    setTransactionStatus((prevState) => ({ ...prevState, signProgress: undefined, isConfirming: true }));

    sendTx(account!.code).then(result => {
      if (result.success) {

        setTransactionDetails((prevState) => ({
          ...prevState,
          sendAll: false,
          proposedAmount: undefined,
          proposedFee: undefined,
          proposedTotal: undefined,
          recipientAddress: '',
          fiatAmount: '',
          amount: '',
          customFee: ''
        }));

        setTransactionStatus((prevState) => ({
          ...prevState,
          isConfirming: true,
          isSent: true,

        }));
        setNote('');

        selectedUTXOs.current = {};

        setTimeout(() => setTransactionStatus(prevState => ({
          ...prevState,
          isSent: false,
          isConfirming: false,
        })), 5000);


      } else if (result.aborted) {

        setTransactionStatus(prevState => ({
          ...prevState,
          isAborted: true
        }));

        setTimeout(() => setTransactionStatus(prevState => ({
          ...prevState,
          isAborted: false
        })), 5000);

      } else {
        switch (result.errorCode) {
        case 'erc20InsufficientGasFunds':
          alertUser(t(`send.error.${result.errorCode}`));
          break;
        default:
          const { errorMessage } = result;
          alertUser(t('unknownError', errorMessage && { errorMessage }));
        }
      }
    })
      .catch((error) => console.error(error))
      .then(() => {

        setTransactionStatus(prevState => ({
          ...prevState,
          isConfirming: false,
          signProgress: undefined,
          signConfirm: false
        }));

      });

  };

  const txInput = () => ({
    address: transactionDetails.recipientAddress,
    amount: transactionDetails.amount,
    feeTarget: transactionDetails.feeTarget || '',
    customFee: transactionDetails.customFee,
    sendAll: transactionDetails.sendAll ? 'yes' : 'no',
    selectedUTXOs: Object.keys(selectedUTXOs.current),
  });

  const sendDisabled = () => {
    const input = txInput();
    return !input.address || transactionDetails.feeTarget === undefined || (input.sendAll === 'no' && !input.amount) || (transactionDetails.feeTarget === 'custom' && !transactionDetails.customFee);
  };

  const validateAndDisplayFee = (updateFiat = true) => {
    setTransactionDetails(prevState => ({
      ...prevState,
      proposedTotal: undefined,
    }));

    setErrorHandling(prevState => ({
      ...prevState,
      addressError: undefined,
      amountError: undefined,
      feeError: undefined,
    }));

    const input = txInput();
    if (sendDisabled()) {
      return;
    }

    if (proposeTimeout.current) {
      clearTimeout(proposeTimeout.current);
      proposeTimeout.current = null;
    }

    setTransactionStatus(prevState => ({
      ...prevState,
      isUpdatingProposal: true
    }));


    proposeTimeout.current = setTimeout(() => {
      const propose = apiPost('account/' + account!.code + '/tx-proposal', input)
        .then(result => {
          const pos = pendingProposals.current.indexOf(propose);
          if (pendingProposals.current.length - 1 === pos) {
            txProposal(updateFiat, result);
          }
          pendingProposals.current.splice(pos, 1);
        })
        .catch(() => {
          setTransactionDetails(prevState => ({ ...prevState, valid: false }));
          pendingProposals.current.splice(pendingProposals.current.indexOf(propose), 1);
        });
      pendingProposals.current.push(propose);
    }, 400);
  };

  const handleNoteInput = (event: Event) => {
    const target = (event.target as HTMLInputElement);
    apiPost('account/' + account!.code + '/propose-tx-note', target.value);
    setNote(target.value);
  };

  const txProposal = (updateFiat: boolean, result: TProposalResult) => {
    setTransactionDetails(prevState => ({
      ...prevState,
      valid: result.success
    }));

    if (result.success) {
      setTransactionDetails(prevState => ({
        ...prevState,
        proposedFee: result.fee,
        proposedAmount: result.amount,
        proposedTotal: result.total,
      }));

      setErrorHandling((prevState) => ({
        ...prevState,
        addressError: undefined,
        amountError: undefined,
        feeError: undefined,
      }));

      setTransactionStatus(prevState => ({ ...prevState, isUpdatingProposal: false }));


      if (updateFiat) {
        convertToFiat(result.amount.amount);
      }
    } else {
      const errorCode = result.errorCode;
      switch (errorCode) {
      case 'invalidAddress':
        setErrorHandling(prevState => ({
          ...prevState,
          addressError: t('send.error.invalidAddress')
        }));
        break;
      case 'invalidAmount':
      case 'insufficientFunds':
        setErrorHandling(prevState => ({
          ...prevState,
          amountError: t(`send.error.${errorCode}`),
        }));
        setTransactionDetails(prevState => ({
          ...prevState,
          proposedFee: undefined,
        }));
        break;
      case 'feeTooLow':
        setErrorHandling(prevState => ({
          ...prevState,
          feeError: t('send.error.feeTooLow')
        }));
        break;
      case 'feesNotAvailable':
        setErrorHandling(prevState => ({
          ...prevState,
          feeError: t('send.error.feesNotAvailable')
        }));
        break;
      default:
        setTransactionDetails(prevState => ({
          ...prevState,
          proposedFee: undefined
        }));
        if (errorCode) {
          unregisterEvents();
          alertUser(errorCode, { callback: registerEvents });
        }
      }
      setTransactionStatus(prevState => ({
        ...prevState,
        isUpdatingProposal: false
      }));
    }
  };

  const handleFormChange = async (event: React.SyntheticEvent) => {
    const target = event.target as HTMLInputElement;
    let value: string | boolean = target.value;

    if (target.type === 'checkbox') {
      value = target.checked;
    }

    if (target.id === 'sendAll') {
      if (!value) {
        convertToFiat(transactionDetails.amount);
      }
    } else if (target.id === 'amount') {
      convertToFiat(value);
    }
    // according to the DOM/JSX
    // target.id here could be: recipientAddress || sendAll || amount
    setTransactionDetails(prevState => ({
      ...prevState,
      [target.id]: value,
    }));
  };

  const handleFiatInput = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    setTransactionDetails((prevState) => ({
      ...prevState,
      fiatAmount: value,
    }));
    convertFromFiat(value);
  };

  const convertToFiat = async (value?: string | boolean) => {
    if (!account) {
      return;
    }
    const result = await convertToFiatService(account.coinCode, transactionDetails.fiatUnit, value);
    setTransactionDetails(prevState => ({ ...prevState, ...result }));
  };

  const convertFromFiat = (value: string) => {
    if (value) {
      const coinCode = account!.coinCode;
      apiGet(`coins/convert-from-fiat?from=${transactionDetails.fiatUnit}&to=${coinCode}&amount=${value}`)
        .then(data => {
          if (data.success) {
            setTransactionDetails(prevState => ({ ...prevState, amount: data.amount }));
          } else {
            setErrorHandling(prevState => ({ ...prevState, amountError: t('send.error.invalidAmount') }));
          }
        });
    } else {
      setTransactionDetails(prevState => ({ ...prevState, amount: '' }));
    }
  };


  const sendToSelf = (event: React.SyntheticEvent) => {
    getReceiveAddressList(account!.code)()
      .then(receiveAddresses => {
        if (receiveAddresses && receiveAddresses.length > 0 && receiveAddresses[0].addresses.length > 1) {
          setTransactionDetails(prevState => ({
            ...prevState,
            recipientAddress: receiveAddresses[0].addresses[0].address
          }));
          handleFormChange(event);
        }
      })
      .catch(console.error);
  };

  const feeTargetChange = (feeTarget: FeeTargetCode) => {
    setTransactionDetails(prevState => ({
      ...prevState,
      feeTarget,
      customFee: ''
    }));

    // After updating state, call `validateAndDisplayFee`
    validateAndDisplayFee(transactionDetails.sendAll);
  };

  const onSelectedUTXOsChange = (selected: TSelectedUTXOs) => {
    selectedUTXOs.current = selected;
    validateAndDisplayFee(true);
  };

  const hasSelectedUTXOs = (): boolean => {
    return Object.keys(selectedUTXOs.current).length !== 0;
  };

  const toggleCoinControl = () => {
    const toggled = !activeCoinControl;
    setActiveCoinControl(prevState => !prevState);
    if (toggled) {
      selectedUTXOs.current = {};
    }
  };

  const parseQRResult = async (uri: string) => {
    let address;
    let amount = '';

    if (!account) {
      return;
    }

    try {
      const url = new URL(uri);
      if (url.protocol !== 'bitcoin:' && url.protocol !== 'litecoin:' && url.protocol !== 'ethereum:') {
        alertUser(t('invalidFormat'));
        return;
      }
      address = url.pathname;
      if (isBitcoinBased(account.coinCode)) {
        amount = url.searchParams.get('amount') || '';
      }
    } catch {
      address = uri;
    }

    let updateState = {
      recipientAddress: address,
      sendAll: false,
      fiatAmount: '',
    } as Pick<TransactionDetailsState, keyof TransactionDetailsState>;

    const coinCode = account!.coinCode;
    if (amount) {
      if (coinCode === 'btc' || coinCode === 'tbtc') {
        const result = await parseExternalBtcAmount(amount);
        if (result.success) {
          updateState['amount'] = result.amount;
        } else {
          setTransactionDetails((prevState) => ({ ...prevState, ...updateState }));
          setErrorHandling((prevState) => ({ ...prevState, amountError:  t('send.error.invalidAmount') }));
          return;
        }
      } else {
        updateState['amount'] = amount;
      }
    }
    setTransactionDetails((prevState) => ({ ...prevState, ...updateState }));
    convertToFiat(updateState.amount);
  };

  const toggleScanQR = () => {
    if (cameraState.activeScanQR) {
      if (qrCodeReader.current) {
        // release camera; invokes the catch function below.
        qrCodeReader.current.reset();
      }
      // should already be false, set by the catch function below. we do it again anyway, in
      // case it is not called consistently on each platform.
      setCameraState((prevState) => ({
        ...prevState,
        activeScanQR: false,
      }));
    } else {
      setCameraState((prevState) => ({
        ...prevState,
        activeScanQR: true,
        videoLoading: true,
      }));
    }
  };

  const handleVideoLoad = () => {
    setCameraState(prevState => ({ ...prevState, videoLoading: false }));
  };

  useEffect(() => {
    const decodeQR = async (qrCodeReaderRef: BrowserQRCodeReader) => {
      try {
        const result = await qrCodeReaderRef.decodeOnceFromVideoDevice(undefined, 'video');
        setCameraState((prevState) => ({ ...prevState, activeScanQR: false }));
        parseQRResult(result.getText());
        if (qrCodeReader.current) {
          qrCodeReader.current.reset(); // release camera
        }
      } catch (error: any) {
        if (error) {
          // Can be translated
          alertUser(error.message || error);
        }
        setCameraState((prevState) => ({ ...prevState, activeScanQR: false }));
      }
    };

    //From toggle scan QR
    if (cameraState.activeScanQR && qrCodeReader.current) {
      decodeQR(qrCodeReader.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraState.activeScanQR]); // Effect runs when activeScanQR changes

  useEffect(() => {
    //When custom fee changes
    validateAndDisplayFee();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionDetails.customFee]);

  useEffect(() => {
    //When transaction amount changes
    if (transactionDetails.amount) {
      validateAndDisplayFee(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionDetails.amount]);

  useEffect(() => {
    //When either sendAll, recipient address, or fiat amount changes
    validateAndDisplayFee(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionDetails.sendAll, transactionDetails.recipientAddress, transactionDetails.fiatAmount]);

  useEffect(() => {
    if (accounts.length === 0 && !account) {
      return () => {};
    }

    const updateBalance = (code: string) => getBalance(code).then(setBalance).catch(console.error);

    if (code) {
      updateBalance(code);
    }

    if (deviceIDs.length > 0 && devices[deviceIDs[0]] === 'bitbox') {
      apiGet('devices/' + deviceIDs[0] + '/has-mobile-channel').then(updatePairingStatus);
    }
    unsubscribeList.current = [
      apiWebsocket(handleWebsocketPayload),
      syncdone(code, updateBalance),
    ];

    import('../../../components/qrcode/qrreader')
      .then(({ BrowserQRCodeReader }) => {
        if (!qrCodeReader.current) {
          qrCodeReader.current = new BrowserQRCodeReader();
        }
        qrCodeReader.current
        //.getVideoInputDevices() -> deprecated
          .listVideoInputDevices()
          .then(videoInputDevices => {
            setCameraState(prevState => ({ ...prevState, hasCamera: videoInputDevices.length > 0 }));
          });
      })
      .catch(console.error);

    registerEvents();

    return () => {
      // componentWillUnmount
      unregisterEvents();
      unsubscribe(unsubscribeList.current);
      if (qrCodeReader.current) {
        qrCodeReader.current.reset();
      }
    };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, account]);


  const handleWebsocketPayload = (payload: TPayload) => {
    if ('type' in payload) {
      const { data, meta } = payload;
      if (payload.type === 'device') {
        if (data === 'signProgress') {
          setTransactionStatus(prevState => ({ ...prevState, signProgress: meta, signConfirm: false }));
        } else if (data === 'signConfirm') {
          setTransactionStatus(prevState => ({ ...prevState, signConfirm: true }));
        }
      }
    }
  };

  const updatePairingStatus = (mobileChannel: boolean) => {
    getDeviceInfo(deviceIDs[0])
      .then(({ pairing }) => {
        const paired = mobileChannel && pairing;
        const noMobileChannelError = pairing && !mobileChannel && account && isBitcoinBased(account.coinCode);
        setPaired(paired);
        setErrorHandling(prevState => ({ ...prevState, noMobileChannelError }));
      });
  };

  const { addressError, amountError, feeError, noMobileChannelError } = errorHandling;
  const {
    recipientAddress,
    amount,
    proposedFee,
    proposedTotal,
    proposedAmount,
    valid,
    fiatAmount,
    fiatUnit,
    sendAll,
    feeTarget,
    customFee,
  } = transactionDetails;
  const { isConfirming, isSent, isAborted, isUpdatingProposal, signProgress, signConfirm } = transactionStatus;
  const { hasCamera, activeScanQR, videoLoading } = cameraState;

  const waitDialogTransactionStatus = {
    isConfirming,
    signProgress,
    signConfirm
  };

  const waitDialogTransactionDetails = {
    proposedFee,
    proposedAmount,
    proposedTotal,
    customFee,
    feeTarget,
    recipientAddress,
    fiatUnit,
  };

  if (!account || !conf) {
    return null;
  }

  const baseCurrencyUnit: ConversionUnit = fiatUnit === 'BTC' && conf.backend.btcUnit === 'sat' ? 'sat' : fiatUnit;

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
              { conf.frontend?.coinControl && (
                <UTXOs
                  accountCode={account.code}
                  active={activeCoinControl}
                  explorerURL={account.blockExplorerTxPrefix}
                  onClose={() => setActiveCoinControl(false)}
                  onChange={onSelectedUTXOsChange} />
              ) }
              <div className={`flex flex-row flex-between ${style.container}`}>
                <label className="labelXLarge">{t('send.transactionDetails')}</label>
                { conf.frontend?.coinControl && (
                  <A href="#" onClick={toggleCoinControl} className="labelLarge labelLink">{t('send.toggleCoinControl')}</A>
                )}
              </div>
              <Grid col="1">
                <Column>
                  <ReceiverAddressInput
                    onClickScanQRButton={toggleScanQR}
                    hasCamera={hasCamera}
                    debug={debug}
                    onInputChange={handleFormChange}
                    onClickSendToSelfButton={sendToSelf}
                    addressError={addressError}
                    recipientAddress={recipientAddress}
                  />
                </Column>
              </Grid>
              <Grid>
                <Column>
                  <CoinInput
                    balance={balance}
                    onInputChange={handleFormChange}
                    sendAll={sendAll}
                    amountError={amountError}
                    proposedAmount={proposedAmount}
                    amount={amount}
                    hasSelectedUTXOs={hasSelectedUTXOs()}
                  />
                </Column>
                <Column>
                  <FiatInput
                    onFiatChange={handleFiatInput}
                    disabled={sendAll}
                    error={amountError}
                    fiatAmount={fiatAmount}
                    label={baseCurrencyUnit}
                  />
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
                    onFeeTargetChange={feeTargetChange}
                    onCustomFee={customFee => setTransactionDetails(prevState => ({ ...prevState, customFee }))}
                    error={feeError} />
                </Column>
                <Column>
                  <NoteInput
                    note={note}
                    onNoteChange={handleNoteInput}
                  />
                  <ColumnButtons
                    className="m-top-default m-bottom-xlarge"
                    inline>
                    <ButtonsGroup
                      onSendButtonClick={send}
                      accountCode={code}
                      isSendButtonDisabled={sendDisabled() || !valid || isUpdatingProposal}
                    />
                  </ColumnButtons>
                </Column>
              </Grid>
              <ConfirmingWaitDialog
                paired={paired}
                baseCurrencyUnit={baseCurrencyUnit}
                note={note}
                hasSelectedUTXOs={hasSelectedUTXOs()}
                selectedUTXOs={Object.keys(selectedUTXOs.current)}
                coinCode={account.coinCode}
                transactionDetails={waitDialogTransactionDetails}
                transactionStatus={waitDialogTransactionStatus}
              />
              <MessageWaitDialog isShown={isSent} messageType={'sent'} />
              <MessageWaitDialog isShown={isAborted} messageType={'abort'} />
              <DialogScanQR
                activeScanQR={activeScanQR}
                onLoadedVideo={handleVideoLoad}
                toggleScanQR={toggleScanQR}
                videoLoading={videoLoading}
              />
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <SendGuide coinCode={account.coinCode} />
    </GuideWrapper>
  );
};

