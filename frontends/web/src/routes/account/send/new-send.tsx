// @ts-nocheck

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FeeTargetCode, IAccount, IAmount, IBalance, getBalance, sendTx } from '../../../api/account';
import { UnsubscribeList, unsubscribe } from '../../../utils/subscriptions';
import { apiGet, apiPost } from '../../../utils/request';
import { getDeviceInfo } from '../../../api/bitbox01';
import { findAccount, isBitcoinBased } from '../utils';
import { TPayload, apiWebsocket } from '../../../utils/websocket';
import { syncdone } from '../../../api/accountsync';
import { BrowserQRCodeReader } from '@zxing/library';
import { BtcUnit } from '../../../api/coins';
import { store as fiat } from '../../../components/rates/rates';
import { alertUser } from '../../../components/alert/Alert';
import { TSelectedUTXOs } from './utxos';

type TSignProgress = {
    steps: number;
    step: number;
}

const Send = ({ code, deviceIDs, devices, accounts }: any) => {
  const { t } = useTranslation();
  const [account, setAccount] = useState<IAccount>();
  const [balance, setBalance] = useState<IBalance>();
  const [proposedFee, setProposedFee] = useState<IAmount>();
  const [proposedTotal, setProposedTotal] = useState<IAmount>();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [proposedAmount, setProposedAmount] = useState<IAmount>();
  const [valid, setValid] = useState(false);
  const [amount, setAmount] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [fiatUnit, setFiatUnit] = useState(fiat.state.active);
  const [sendAll, setSendAll] = useState(false);
  const [feeTarget, setFeeTarget] = useState<FeeTargetCode>();
  const [customFee, setCustomFee] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const [isUpdatingProposal, setIsUpdatingProposal] = useState(false);
  const [addressError, setAddressError] = useState<string>();
  const [amountError, setAmountError] = useState<string>();
  const [feeError, setFeeError] = useState<string>();
  const [paired, setPaired] = useState<boolean>();
  const [noMobileChannelError, setNoMobileChannelError] = useState<boolean>();
  const [signProgress, setSignProgress] = useState<TSignProgress>();
  const [signConfirm, setSignConfirm] = useState(false);
  const [coinControl, setCoinControl] = useState(false);
  const [btcUnit, setBtcUnit] = useState<BtcUnit>('default');
  const [activeCoinControl, setActiveCoinControl] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [activeScanQR, setActiveScanQR] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [note, setNote] = useState('');


  const [selectedUTXOs, setSelectedUTXOs] = useState<TSelectedUTXOs>({});
  let qrCodeReader: BrowserQRCodeReader | undefined;
  let pendingProposals: any = [];
  let proposeTimeout: any = null;

  const handleKeyDown = () => {

  };

  const registerEvents = () => {
    document.addEventListener('keydown', handleKeyDown);
  };

  const unregisterEvents = () => {
    document.removeEventListener('keydown', handleKeyDown);
  };


  const getAccount = () => {
    if (!code) {
      return undefined;
    }

    return findAccount(accounts, code);
  };

  const checkIsBTCBased = () => {
    const account = getAccount();
    if (!account) {
      return false;
    }
    return isBitcoinBased(account.coinCode);
  };


  const loadQRCodeReader = () => {
    import('../../../components/qrcode/qrreader')
      .then(({ BrowserQRCodeReader }) => {
        if (!qrCodeReader) {
          qrCodeReader = new BrowserQRCodeReader();
        }
        qrCodeReader
          .getVideoInputDevices()
          .then(videoInputDevices => {
            setHasCamera(videoInputDevices.length > 0);
          });
      })
      .catch(console.error);
  };

  registerEvents();
  loadQRCodeReader();

  //   useEffect(() => {


  //   }, []);


  const handleSend = () => {
    if (noMobileChannelError) {
      alertUser(t('warning.sendPairing'));
      return;
    }
    setIsConfirming(true);
    sendTx(getAccount()!.code)
      .then(result => {
        if (result.success) {
          setIsSent(true);
          setRecipientAddress('');
          setProposedAmount(undefined);
          setProposedFee(undefined);
          setProposedTotal(undefined);
          setFiatAmount('');
          setAmount('');
          setNote('');
          setCustomFee('');
          setSelectedUTXOs({});
          setTimeout(() => {
            setIsSent(false);
            setIsConfirming(false);
          }, 5000);
        } else if (result.aborted) {
          setIsAborted(true);
          setTimeout(() => setIsAborted(false), 5000);
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
      .catch(error => console.error(error))
      .then(() => {
        setIsConfirming(false);
        setSignProgress(undefined);
        setSignConfirm(false);
      });
  };


  const txInput = () => ({
    address: recipientAddress,
    amount: amount,
    feeTarget: feeTarget || '',
    customFee: customFee,
    sendAll: sendAll ? 'yes' : 'no',
    selectedUTXOs: Object.keys(selectedUTXOs),
  });

  const sendDisabled = () => {
    const inputs = txInput();
    return !inputs.address || feeTarget === undefined || (inputs.sendAll === 'no' && !inputs.amount) || (feeTarget === 'custom' && !customFee);
  };

  const validateAndDisplayFee = (updateFiat: boolean = true) => {
    setProposedTotal(undefined);
    setAddressError(undefined);
    setAmountError(undefined);
    setFeeError(undefined);
    if (sendDisabled()) {
      return;
    }
    const inputs = txInput();
    if (proposeTimeout) {
      clearTimeout(proposeTimeout);
      proposeTimeout = null;
    }
    setIsUpdatingProposal(true);
    proposeTimeout = setTimeout(() => {
      const propose = apiPost('account/' + getAccount()!.code + '/tx-proposal', inputs)
        .then(result => {
          const pos = pendingProposals.indexOf(propose);
          if (pendingProposals.length - 1 === pos) {
            txProposal(updateFiat, result);
          }
          pendingProposals.splice(pos, 1);
        })
        .catch(() => {
          setValid(false);
          pendingProposals.splice(pendingProposals.indexOf(propose), 1);
        });
      pendingProposals.push(propose);
    }, 400);
  };



  useEffect(() => {
    if (code) {
      getBalance(code)
        .then(balance => setBalance(balance))
        .catch(console.error);
    }

    //If BB01
    if (deviceIDs.length > 0 && devices[deviceIDs[0]] === 'bitbox') {
      apiGet('devices/' + deviceIDs[0] + '/has-mobile-channel')
        .then((mobileChannel) => {
          getDeviceInfo(deviceIDs[0])
            .then(({ pairing }) => {
              const account = getAccount();
              const paired = mobileChannel && pairing;
              const noMobileChannelError = pairing && !mobileChannel && account && isBitcoinBased(account.coinCode);
              setPaired(paired);
              setNoMobileChannelError(noMobileChannelError);
            });
        });
    }

    apiGet('config')
      .then((config) => {
        setBtcUnit(config.backend.btcUnit);
        if (checkIsBTCBased()) {
          setCoinControl(!!(config.frontend || {}).coinControl);
        }
      });

    const websocketCallback = (payload: TPayload) => {
      if ('type' in payload) {
        const { data, meta, type } = payload;
        switch (type) {
        case 'device':
          switch (data) {
          case 'signProgress':
            setSignProgress(meta);
            setSignConfirm(false);
            break;
          case 'signConfirm':
            setSignConfirm(true);
            break;
          }
          break;
        }
      }
    };

    const syncdoneCallback = (code: string) => {
      getBalance(code)
        .then(balance => setBalance(balance))
        .catch(console.error);
    };

    const unsubscribeList: UnsubscribeList = [
      apiWebsocket(websocketCallback),
      syncdone(code, syncdoneCallback)
    ];

    return () => {
      unregisterEvents();
      unsubscribe(unsubscribeList);
      if (qrCodeReader) {
        qrCodeReader.reset();
      }
    };
  }, [checkIsBTCBased, code, deviceIDs, devices, getAccount, qrCodeReader, unregisterEvents]);


  return (
    <div>Send</div>
  );
};

export default Send;