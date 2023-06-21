import { useEffect, useState, useRef, useCallback } from 'react';
import { route } from '../../../utils/route';
import { ConversionUnit, FeeTargetCode, IAccount, IAmount, IBalance, getBalance, getReceiveAddressList, sendTx } from '../../../api/account';
import { findAccount, isBitcoinBased, customFeeUnit, isBitcoinOnly } from '../utils';
import { useTranslation } from 'react-i18next';
import { alertUser } from '../../../components/alert/Alert';
import { apiGet, apiPost } from '../../../utils/request';
import { parseExternalBtcAmount } from '../../../api/coins';
import { store } from '../../../components/rates/rates';
import { TSelectedUTXOs, UTXOs } from './utxos';
import { BrowserQRCodeReader } from '@zxing/library';
import { TDevices } from '../../../api/devices';
import { getDeviceInfo } from '../../../api/bitbox01';
import { apiWebsocket } from '../../../utils/websocket';
import { syncdone } from '../../../api/accountsync';
import { UnsubscribeList, unsubscribe } from '../../../utils/subscriptions';
import { Guide } from '../../../components/guide/guide';
import { Entry } from '../../../components/guide/entry';
import { Dialog } from '../../../components/dialog/dialog';
import { Button, ButtonLink, Checkbox, Input } from '../../../components/forms';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';
import A from '../../../components/anchor/anchor';
import { Amount } from '../../../components/amount/amount';
import { Checked, Cancel } from '../../../components/icon/icon';
import { Column, ColumnButtons, Grid, Header } from '../../../components/layout';
import { Spinner } from '../../../components/spinner/Spinner';
import { Status } from '../../../components/status/status';
import { Balance } from '../../../components/balance/balance';
import qrcodeIconDark from '../../../assets/icons/qrcode-dark.png';
import qrcodeIconLight from '../../../assets/icons/qrcode-light.png';
import { debug } from '../../../utils/env';
import { FeeTargets } from './feetargets';
import { CameraState, CoinControlSettingsState, ErrorHandlingState, TransactionDetailsState, TransactionStatusState } from './types';
import style from './send.module.css';

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

  // Bitcoin Settings:
  const [coinControlState, setCoinControlState] = useState<CoinControlSettingsState>({
    coinControl: false,
    btcUnit: 'default',
    activeCoinControl: false,
  });

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

  const isBTCBased = () => {
    const account = getAccount();
    if (!account) {
      return false;
    }
    return isBitcoinBased(account.coinCode);
  };



  const registerEvents = () => {
    document.addEventListener('keydown', handleKeyDown);
  };

  const unregisterEvents = () => {
    document.removeEventListener('keydown', handleKeyDown);
  };


  const handleKeyDown = useCallback((e) => {
    if (e.keyCode === 27 && !coinControlState.activeCoinControl && !cameraState.activeScanQR) {
      route(`/account/${code}`);
    }
  }, [coinControlState.activeCoinControl, cameraState.activeScanQR, code]);

  const send = () => {
    if (noMobileChannelError) {
      alertUser(t('warning.sendPairing'));
      return;
    }

    setTransactionStatus((prevState) => ({ ...prevState, signProgress: undefined, isConfirming: true }));


    sendTx(getAccount()!.code).then(result => {
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
      const propose = apiPost('account/' + getAccount()!.code + '/tx-proposal', input)
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
    apiPost('account/' + getAccount()!.code + '/propose-tx-note', target.value);
    setNote(target.value);

  };
  const txProposal = (updateFiat: boolean, result: {
    errorCode?: string;
    amount: IAmount;
    fee: IAmount;
    success: boolean;
    total: IAmount;
}) => {
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

  const handleFormChange = (event: React.SyntheticEvent) => {
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
    // target.ids are: recipientAddress || sendAll || amount
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

  const convertToFiat = (value?: string | boolean) => {
    if (value) {
      const coinCode = getAccount()!.coinCode;
      apiGet(`coins/convert-to-plain-fiat?from=${coinCode}&to=${transactionDetails.fiatUnit}&amount=${value}`)
        .then(data => {
          if (data.success) {
            setTransactionDetails((prevState) => ({
              ...prevState,
              fiatAmount: data.fiatAmount,
            }));
          } else {
            setErrorHandling(prevState => ({ ...prevState, amountError: t('send.error.invalidAmount') }));
          }
        });
    } else {
      setTransactionDetails(prevState => ({ ...prevState, fiatAmount: '' }));
    }
  };

  const convertFromFiat = (value: string) => {
    if (value) {
      const coinCode = getAccount()!.coinCode;
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
    getReceiveAddressList(getAccount()!.code)()
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

  const getAccount = (): IAccount | undefined => {
    if (!code) {
      return undefined;
    }
    const gws = findAccount(accounts, code);

    return gws;
  };

  const toggleCoinControl = () => {
    const toggled = !coinControlState.activeCoinControl;
    setCoinControlState(prevState => ({ ...prevState, activeCoinControl: !prevState.activeCoinControl }));
    if (toggled) {
      selectedUTXOs.current = {};
    }
  };

  const parseQRResult = async (uri: string) => {
    let address;
    let amount = '';

    try {
      const url = new URL(uri);
      if (url.protocol !== 'bitcoin:' && url.protocol !== 'litecoin:' && url.protocol !== 'ethereum:') {
        alertUser(t('invalidFormat'));
        return;
      }
      address = url.pathname;
      if (isBTCBased()) {
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

    const account = getAccount(); // Replace with the correct method to get account
    const coinCode = account?.coinCode;
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


  const deactivateCoinControl = () => {
    setCoinControlState(prevState => ({ ...prevState, activeCoinControl: false }));
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
  }, [cameraState.activeScanQR]); // Effect runs when activeScanQR changes

  useEffect(() => {
    validateAndDisplayFee();
  }, [transactionDetails.customFee]);

  useEffect(() => {
    if (transactionDetails.amount) {
      validateAndDisplayFee(false);
    }
  }, [transactionDetails.amount]);

  useEffect(() => {
    validateAndDisplayFee(true);
  }, [transactionDetails.sendAll, transactionDetails.recipientAddress, transactionDetails.fiatAmount]);

  useEffect(() => {
    // Corresponding to componentDidMount and UNSAFE_componentWillMount...
    if (code) {
      getBalance(code)
        .then(balance => setBalance(balance))
        .catch(console.error);
    }
    if (deviceIDs.length > 0 && devices[deviceIDs[0]] === 'bitbox') {
      apiGet('devices/' + deviceIDs[0] + '/has-mobile-channel').then((mobileChannel: boolean) => {
        getDeviceInfo(deviceIDs[0])
          .then(({ pairing }) => {
            const account = getAccount();
            const paired = mobileChannel && pairing;
            const noMobileChannelError = pairing && !mobileChannel && account && isBitcoinBased(account.coinCode);
            setPaired(paired);
            setErrorHandling(prevState => ({ ...prevState, noMobileChannelError }));
          });
      });
    }
    apiGet('config').then(config => {
      setCoinControlState(prevState => ({ ...prevState, btcUnit: config.backend.btcUnit }));
      if (isBTCBased()) {
        setCoinControlState(prevState => ({ ...prevState, coinControl: !!(config.frontend || {}).coinControl }));
      }
    });

    unsubscribeList.current = [
      apiWebsocket((payload) => {
        if ('type' in payload) {
          const { data, meta, type } = payload;
          switch (type) {
          case 'device':
            switch (data) {
            case 'signProgress':
              setTransactionStatus(prevState => ({ ...prevState, signProgress: meta, signConfirm: false }));
              break;
            case 'signConfirm':
              setTransactionStatus(prevState => ({ ...prevState, signConfirm: true }));
              break;
            }
            break;
          }
        }
      }),
      syncdone(code, (code) => {
        getBalance(code)
          .then(balance => setBalance(balance))
          .catch(console.error);
      }),
    ];

    import('../../../components/qrcode/qrreader')
      .then(({ BrowserQRCodeReader }) => {
        if (!qrCodeReader.current) {
          qrCodeReader.current = new BrowserQRCodeReader();
        }
        qrCodeReader.current
          .getVideoInputDevices()
          .then(videoInputDevices => {
            setCameraState(prevState => ({ ...prevState, hasCamera: videoInputDevices.length > 0 }));
          });
      })
      .catch(console.error);

    registerEvents();

    return () => {
      // Corresponding to componentWillUnmount...
      unregisterEvents();
      unsubscribe(unsubscribeList.current);
      if (qrCodeReader.current) {
        qrCodeReader.current.reset();
      }
    };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const { coinControl, btcUnit, activeCoinControl } = coinControlState;

  const { hasCamera, activeScanQR, videoLoading } = cameraState;



  const account = getAccount();

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
  const baseCurrencyUnit: ConversionUnit = fiatUnit === 'BTC' && btcUnit === 'sat' ? 'sat' : fiatUnit;

  return (
    <div className="contentWithGuide">
      <div className="container">
        <Status type="warning" hidden={paired !== false}>
          {t('warning.sendPairing')}
        </Status>
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{t('send.title', { accountName: account.coinName })}</h2>} />
          <div className="content padded">
            <div>
              <label className="labelXLarge">{t('send.availableBalance')}</label>
            </div>
            <Balance balance={balance} noRotateFiat/>
            { coinControl && (
              <UTXOs
                accountCode={account.code}
                active={activeCoinControl}
                explorerURL={account.blockExplorerTxPrefix}
                onClose={deactivateCoinControl}
                onChange={onSelectedUTXOsChange} />
            ) }
            <div className={`flex flex-row flex-between ${style.container}`}>
              <label className="labelXLarge">{t('send.transactionDetails')}</label>
              { coinControl && (
                <A href="#" onClick={toggleCoinControl} className="labelLarge labelLink">{t('send.toggleCoinControl')}</A>
              )}
            </div>
            <Grid col="1">
              <Column>
                <Input
                  label={t('send.address.label')}
                  placeholder={t('send.address.placeholder')}
                  id="recipientAddress"
                  error={addressError}
                  onInput={handleFormChange}
                  value={recipientAddress}
                  className={hasCamera ? style.inputWithIcon : ''}
                  labelSection={debug ? (
                    <span id="sendToSelf" className={style.action} onClick={sendToSelf}>
                        Send to self
                    </span>
                  ) : undefined}
                  autoFocus>
                  { hasCamera && (
                    <button onClick={toggleScanQR} className={style.qrButton}>
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
                  onInput={handleFormChange}
                  disabled={sendAll}
                  error={amountError}
                  value={sendAll ? (proposedAmount ? proposedAmount.amount : '') : amount}
                  placeholder={t('send.amount.placeholder')}
                  labelSection={
                    <Checkbox
                      label={t(hasSelectedUTXOs() ? 'send.maximumSelectedCoins' : 'send.maximum')}
                      id="sendAll"
                      onChange={handleFormChange}
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
                  onInput={handleFiatInput}
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
                  onFeeTargetChange={feeTargetChange}
                  onCustomFee={customFee => setTransactionDetails(prevState => ({ ...prevState, customFee }))}
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
                  onInput={handleNoteInput}
                  value={note}
                  placeholder={t('note.input.placeholder')} />
                <ColumnButtons
                  className="m-top-default m-bottom-xlarge"
                  inline>
                  <Button
                    primary
                    onClick={send}
                    disabled={sendDisabled() || !valid || isUpdatingProposal}>
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
                    {(proposedAmount &&
                        <Amount amount={proposedAmount.amount} unit={proposedAmount.unit}/>) || 'N/A'}
                    {' '}
                    <small>{(proposedAmount && proposedAmount.unit) || 'N/A'}</small>
                  </span>
                  {
                    proposedAmount && proposedAmount.conversions && (
                      <span>
                        <span className="text-gray"> / </span>
                        <Amount amount={proposedAmount.conversions[fiatUnit]} unit={baseCurrencyUnit}/>
                        {' '}<small>{baseCurrencyUnit}</small>
                      </span>)
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
                    {(proposedFee &&
                        <Amount amount={proposedFee.amount} unit={proposedFee.unit}/>) || 'N/A'}
                    {' '}
                    <small>{(proposedFee && proposedFee.unit) || 'N/A'}</small>
                  </span>
                  {proposedFee && proposedFee.conversions && (
                    <span key="conversation">
                      <span className="text-gray"> / </span>
                      <Amount amount={proposedFee.conversions[fiatUnit]} unit={baseCurrencyUnit}/>
                      {' '}<small>{baseCurrencyUnit}</small>
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
                hasSelectedUTXOs() && (
                  <div className={[style.confirmItem].join(' ')}>
                    <label>{t('send.confirm.selected-coins')}</label>
                    {
                      Object.keys(selectedUTXOs).map((uxto, i) => (
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
                    <strong>
                      {(proposedTotal &&
                        <Amount amount={proposedTotal.amount} unit={proposedTotal.unit}/>) || 'N/A'}
                    </strong>
                    {' '}
                    <small>{(proposedTotal && proposedTotal.unit) || 'N/A'}</small>
                  </span>
                  {(proposedTotal && proposedTotal.conversions) && (
                    <span>
                      <span className="text-gray"> / </span>
                      <strong><Amount amount={proposedTotal.conversions[fiatUnit]} unit={baseCurrencyUnit}/></strong>
                      {' '}<small>{baseCurrencyUnit}</small>
                    </span>
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
                <Checked style={{ height: 18, marginRight: '1rem' }} />{t('send.success')}
              </div>
            </WaitDialog>
          )
        }
        {
          isAborted && (
            <WaitDialog>
              <div className="flex flex-row flex-center flex-items-center">
                <Cancel alt="Abort" style={{ height: 18, marginRight: '1rem' }} />{t('send.abort')}
              </div>
            </WaitDialog>
          )
        }
        <Dialog
          open={activeScanQR}
          title={t('send.scanQR')}
          onClose={toggleScanQR}>
          {videoLoading && <Spinner guideExists />}
          <video
            id="video"
            width={400}
            height={300 /* fix height to avoid ugly resize effect after open */}
            className={style.qrVideo}
            onLoadedData={handleVideoLoad} />
          <div className={['buttons', 'flex', 'flex-row', 'flex-between'].join(' ')}>
            <Button
              secondary
              onClick={toggleScanQR}>
              {t('button.back')}
            </Button>
          </div>
        </Dialog>
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
};

