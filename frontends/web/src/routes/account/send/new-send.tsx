import { useEffect, useState, useRef, useCallback } from 'react';
import { route } from '../../../utils/route';
import { ConversionUnit, FeeTargetCode, Fiat, IAccount, IAmount, IBalance, getBalance, getReceiveAddressList, sendTx } from '../../../api/account';
import { findAccount, isBitcoinBased, customFeeUnit, isBitcoinOnly } from '../utils';
import { useTranslation } from 'react-i18next';
import { alertUser } from '../../../components/alert/Alert';
import { apiGet, apiPost } from '../../../utils/request';
import { BtcUnit, parseExternalBtcAmount } from '../../../api/coins';
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
import style from './send.module.css';
interface SignProgress {
  steps: number;
  step: number;
}

interface State {
  account?: IAccount;
  balance?: IBalance;
  proposedFee?: IAmount;
  proposedTotal?: IAmount;
  recipientAddress: string;
  proposedAmount?: IAmount;
  valid: boolean;
  amount: string;
  fiatAmount: string;
  fiatUnit: Fiat;
  sendAll: boolean;
  feeTarget?: FeeTargetCode;
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

interface SendProps {
  accounts: IAccount[];
  code: string;
  devices: TDevices;
  deviceIDs: string[];
}

export const NewSend = ({ accounts, code, deviceIDs, devices }: SendProps) => {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({
    account: undefined,
    balance: undefined,
    proposedFee: undefined,
    proposedTotal: undefined,
    recipientAddress: '',
    proposedAmount: undefined,
    valid: false,
    amount: '',
    fiatAmount: '',
    fiatUnit: store.state.active,
    sendAll: false,
    feeTarget: undefined,
    customFee: '',
    isConfirming: false,
    isSent: false,
    isAborted: false,
    isUpdatingProposal: false,
    addressError: undefined,
    amountError: undefined,
    feeError: undefined,
    paired: undefined,
    noMobileChannelError: undefined,
    signProgress: undefined,
    signConfirm: false,
    coinControl: false,
    btcUnit: 'default',
    activeCoinControl: false,
    hasCamera: false,
    activeScanQR: false,
    videoLoading: false,
    note: '',
  });

  const selectedUTXOs = useRef<TSelectedUTXOs>({});
  const unsubscribeList = useRef<UnsubscribeList>([]);
  const qrCodeReader = useRef<BrowserQRCodeReader>();
  const pendingProposals = useRef<any[]>([]);
  const proposeTimeout = useRef<any>(null);

  const isBTCBased = () => {
    const account = getAccount(); // Assuming getAccount is a function defined elsewhere
    if (!account) {
      return false;
    }
    return isBitcoinBased(account.coinCode);
  };



  const registerEvents = () => {
    document.addEventListener('keydown', handleKeyDown); // Assuming handleKeyDown is a function defined elsewhere
  };

  const unregisterEvents = () => {
    document.removeEventListener('keydown', handleKeyDown);
  };

  // The rest of your functional component

  // Use useCallback to avoid unnecessary re-renders if these functions are used as dependencies in useEffect or other similar hooks.
  const handleKeyDown = useCallback((e) => {
    if (e.keyCode === 27 && !state.activeCoinControl && !state.activeScanQR) {
      route(`/account/${code}`);
    }
  }, [state.activeCoinControl, state.activeScanQR, code]);

  const send = () => {
    if (state.noMobileChannelError) {
      alertUser(t('warning.sendPairing'));
      return;
    }
    setState(prevState => ({
      ...prevState,
      signProgress: undefined,
      isConfirming: true
    }));

    sendTx(getAccount()!.code).then(result => {
      if (result.success) {
        setState(prevState => ({
          ...prevState,
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
        }));

        selectedUTXOs.current = {};

        setTimeout(() => setState(prevState => ({
          ...prevState,
          isSent: false,
          isConfirming: false,
        })), 5000);

      } else if (result.aborted) {
        setState(prevState => ({
          ...prevState,
          isAborted: true
        }));

        setTimeout(() => setState(prevState => ({
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
        // The following method allows pressing escape again.
        setState(prevState => ({
          ...prevState,
          isConfirming: false,
          signProgress: undefined,
          signConfirm: false
        }));
      });

  };

  const txInput = () => ({
    address: state.recipientAddress,
    amount: state.amount,
    feeTarget: state.feeTarget || '',
    customFee: state.customFee,
    sendAll: state.sendAll ? 'yes' : 'no',
    selectedUTXOs: Object.keys(selectedUTXOs.current),
  });

  const sendDisabled = () => {
    const input = txInput();
    return !input.address || state.feeTarget === undefined || (input.sendAll === 'no' && !input.amount) || (state.feeTarget === 'custom' && !state.customFee);
  };


  const validateAndDisplayFee = (updateFiat = true) => {
    setState(prevState => ({
      ...prevState,
      proposedTotal: undefined,
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

    setState(prevState => ({
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
          setState(prevState => ({ ...prevState, valid: false }));
          pendingProposals.current.splice(pendingProposals.current.indexOf(propose), 1);
        });
      pendingProposals.current.push(propose);
    }, 400);
  };

  const handleNoteInput = (event: Event) => {
    const target = (event.target as HTMLInputElement);
    apiPost('account/' + getAccount()!.code + '/propose-tx-note', target.value);
    setState(prevState => ({ ...prevState, note: target.value }));

  };
  const txProposal = (updateFiat: boolean, result: {
    errorCode?: string;
    amount: IAmount;
    fee: IAmount;
    success: boolean;
    total: IAmount;
}) => {
    setState(prevState => ({
      ...prevState,
      valid: result.success
    }));

    if (result.success) {
      setState(prevState => ({
        ...prevState,
        addressError: undefined,
        amountError: undefined,
        feeError: undefined,
        proposedFee: result.fee,
        proposedAmount: result.amount,
        proposedTotal: result.total,
        isUpdatingProposal: false,
      }));

      if (updateFiat) {
        convertToFiat(result.amount.amount);
      }
    } else {
      const errorCode = result.errorCode;
      switch (errorCode) {
      case 'invalidAddress':
        setState(prevState => ({
          ...prevState,
          addressError: t('send.error.invalidAddress')
        }));
        break;
      case 'invalidAmount':
      case 'insufficientFunds':
        setState(prevState => ({
          ...prevState,
          amountError: t(`send.error.${errorCode}`),
          proposedFee: undefined,
        }));
        break;
      case 'feeTooLow':
        setState(prevState => ({
          ...prevState,
          feeError: t('send.error.feeTooLow')
        }));
        break;
      case 'feesNotAvailable':
        setState(prevState => ({
          ...prevState,
          feeError: t('send.error.feesNotAvailable')
        }));
        break;
      default:
        setState(prevState => ({
          ...prevState,
          proposedFee: undefined
        }));
        if (errorCode) {
          unregisterEvents();
          alertUser(errorCode, { callback: registerEvents });
        }
      }
      setState(prevState => ({
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
        convertToFiat(state.amount);
      }
    } else if (target.id === 'amount') {
      convertToFiat(value);
    }

    setState(prevState => ({
      ...prevState,
      [target.id]: value,
    }));



  };


  const handleFiatInput = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    setState((prevState) => ({
      ...prevState,
      fiatAmount: value,
    }));
    convertFromFiat(value);
  };

  const convertToFiat = (value?: string | boolean) => {
    if (value) {
      const coinCode = getAccount()!.coinCode;
      apiGet(`coins/convert-to-plain-fiat?from=${coinCode}&to=${state.fiatUnit}&amount=${value}`)
        .then(data => {
          if (data.success) {
            setState(prevState => ({ ...prevState, fiatAmount: data.fiatAmount }));
          } else {
            setState(prevState => ({ ...prevState, amountError: t('send.error.invalidAmount') }));
          }
        });
    } else {
      setState(prevState => ({ ...prevState, fiatAmount: '' }));
    }
  };

  const convertFromFiat = (value: string) => {
    if (value) {
      const coinCode = getAccount()!.coinCode;
      apiGet(`coins/convert-from-fiat?from=${state.fiatUnit}&to=${coinCode}&amount=${value}`)
        .then(data => {
          if (data.success) {
            setState(prevState => ({ ...prevState, amount: data.amount }));
            // validateAndDisplayFee(false);
          } else {
            setState(prevState => ({ ...prevState, amountError: t('send.error.invalidAmount') }));
          }
        });
    } else {
      setState(prevState => ({ ...prevState, amount: '' }));
    }
  };


  const sendToSelf = (event: React.SyntheticEvent) => {
    getReceiveAddressList(getAccount()!.code)()
      .then(receiveAddresses => {
        if (receiveAddresses && receiveAddresses.length > 0 && receiveAddresses[0].addresses.length > 1) {
          setState(prevState => ({ ...prevState, recipientAddress: receiveAddresses[0].addresses[0].address }));
          handleFormChange(event);
        }
      })
      .catch(console.error);
  };

  const feeTargetChange = (feeTarget: FeeTargetCode) => {
    setState(prevState => ({
      ...prevState,
      feeTarget,
      customFee: ''
    }));

    // After updating state, call `validateAndDisplayFee`
    validateAndDisplayFee(state.sendAll);
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
    const toggled = !state.activeCoinControl;
    setState(prevState => ({
      ...prevState,
      activeCoinControl: !prevState.activeCoinControl,
    }));
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
      amount: '',
      amountError: ''
    };

    const account = getAccount(); // Replace with the correct method to get account
    const coinCode = account?.coinCode;
    if (amount) {
      if (coinCode === 'btc' || coinCode === 'tbtc') {
        const result = await parseExternalBtcAmount(amount);
        if (result.success) {
          updateState.amount = result.amount;
        } else {
          updateState.amountError = t('send.error.invalidAmount');
          setState({ ...state, ...updateState });
          return;
        }
      } else {
        updateState['amount'] = amount;
      }
    }

    setState({ ...state, ...updateState });
    convertToFiat(state.amount);
    validateAndDisplayFee(true);
  };

  const toggleScanQR = () => {
    if (state.activeScanQR) {
      if (qrCodeReader.current) {
        // release camera; invokes the catch function below.
        qrCodeReader.current.reset();
      }
      // should already be false, set by the catch function below. we do it again anyway, in
      // case it is not called consistently on each platform.
      setState({ ...state, activeScanQR: false });
    } else {
      setState({
        ...state,
        activeScanQR: true,
        videoLoading: true,
      });
    }
  };


  const handleVideoLoad = () => {
    setState(prevState => ({ ...prevState, videoLoading: false }));
  };


  const deactivateCoinControl = () => {
    setState(prevState => ({ ...prevState, activeCoinControl: false }));
  };

  useEffect(() => {
    //Toggle scan QR
    if (state.activeScanQR && qrCodeReader.current) {
      qrCodeReader.current.decodeFromInputVideoDevice(undefined, 'video')
        .then(result => {
          setState({ ...state, activeScanQR: false });
          parseQRResult(result.getText());
          qrCodeReader.current && qrCodeReader.current.reset(); // release camera
        })
        .catch((error) => {
          if (error) {
            alertUser(error.message || error);
          }
          setState({ ...state, activeScanQR: false });
        });
    }
  }, [state.activeScanQR, qrCodeReader.current]); // Effect runs when activeScanQR or qrCodeReader.current changes

  useEffect(() => {
    validateAndDisplayFee();
  }, [state.customFee]);

  useEffect(() => {
    if (state.amount) {
      validateAndDisplayFee(false);
    }
  }, [state.amount]);

  useEffect(() => {
    validateAndDisplayFee(true);
  }, [state.sendAll, state.recipientAddress, state.amount]);

  useEffect(() => {
    // Corresponding to componentDidMount and UNSAFE_componentWillMount...
    if (code) {
      getBalance(code)
        .then(balance => setState(prevState => ({ ...prevState, balance })))
        .catch(console.error);
    }
    if (deviceIDs.length > 0 && devices[deviceIDs[0]] === 'bitbox') {
      apiGet('devices/' + deviceIDs[0] + '/has-mobile-channel').then((mobileChannel: boolean) => {
        getDeviceInfo(deviceIDs[0])
          .then(({ pairing }) => {
            const account = getAccount();
            const paired = mobileChannel && pairing;
            const noMobileChannelError = pairing && !mobileChannel && account && isBitcoinBased(account.coinCode);
            setState(prevState => ({ ...prevState, paired, noMobileChannelError }));
          });
      });
    }
    apiGet('config').then(config => {
      setState(prevState => ({ ...prevState, btcUnit: config.backend.btcUnit }));
      if (isBTCBased()) {
        setState(prevState => ({ ...prevState, coinControl: !!(config.frontend || {}).coinControl }));
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
              setState(prevState => ({ ...prevState, signProgress: meta, signConfirm: false }));
              break;
            case 'signConfirm':
              setState(prevState => ({ ...prevState, signConfirm: true }));
              break;
            }
            break;
          }
        }
      }),
      syncdone(code, (code) => {
        getBalance(code)
          .then(balance => setState(prevState => ({ ...prevState, balance })))
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
            setState(prevState => ({ ...prevState, hasCamera: true }));
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
  }, []); // Empty array means this useEffect will run once on component mount and clean up on unmount

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
  } = state;

  const account = getAccount();

  if (!account) {
    return <p>no account...</p>;
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
    // JSX
    <>
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
                    onCustomFee={customFee => setState(prevState => ({ ...prevState, customFee }))}
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
    </>
  );
};

