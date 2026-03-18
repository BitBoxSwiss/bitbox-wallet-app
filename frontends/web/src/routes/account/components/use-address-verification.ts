// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountCode, TUsedAddress } from '@/api/account';
import { cancelConnectKeystore } from '@/api/backend';
import { SKIP_DEVICE_VERIFICATION_PARAM } from '../utils';
import { verifyAddressWithDevice, handleVerifyAddressWithDeviceResult } from './verify-address';

export type TVerifyState = 'idle' | 'connecting' | 'connectFailed' | 'skipWarning' | 'skipped' | 'verifying' | 'error';

type TUseAddressVerificationParams = {
  code: AccountCode;
  rootFingerprint?: string;
  selectedAddress: TUsedAddress | null;
  isVerifyView: boolean;
  returnToList: (expandedID?: string) => void;
};

export type TUseAddressVerificationResult = {
  verifyState: TVerifyState;
  verifyError: string | null;
  hasSkipDeviceVerificationQuery: boolean;
  startVerifyFlow: (addressID: string) => void;
  retryVerify: () => void;
  skipVerify: () => void;
};

export const useAddressVerification = ({
  code,
  rootFingerprint,
  selectedAddress,
  isVerifyView,
  returnToList,
}: TUseAddressVerificationParams): TUseAddressVerificationResult => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [verifyState, setVerifyState] = useState<TVerifyState>('idle');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyAttempt, setVerifyAttempt] = useState(0);
  const verifyStateRef = useRef<TVerifyState>('idle');
  // Set synchronously by the skip-detection effect so the verify effect's
  // async callback can check it before handling a userAbort that was actually
  // caused by KeystoreConnectPrompt.skipDeviceVerification cancelling the
  // pending connectKeystore call.
  const skipInitiatedRef = useRef(false);

  const hasSkipDeviceVerificationQuery = isVerifyView
    && new URLSearchParams(location.search).get(SKIP_DEVICE_VERIFICATION_PARAM) === '1';

  useEffect(() => {
    verifyStateRef.current = verifyState;
  }, [verifyState]);

  // Handle skipDeviceVerification query param: set skipWarning state and clean URL.
  // Separated from the verify effect to avoid re-triggering verification when
  // location.search changes during param cleanup.
  useEffect(() => {
    if (!isVerifyView) {
      return;
    }
    const params = new URLSearchParams(location.search);
    if (params.get(SKIP_DEVICE_VERIFICATION_PARAM) !== '1') {
      return;
    }
    skipInitiatedRef.current = true;
    setVerifyError(null);
    setVerifyState('skipWarning');
    params.delete(SKIP_DEVICE_VERIFICATION_PARAM);
    const search = params.toString();
    navigate({
      pathname: location.pathname,
      search: search ? `?${search}` : '',
    }, { replace: true });
  }, [isVerifyView, location.pathname, location.search, navigate]);

  useEffect(() => {
    const selectedAddressID = selectedAddress?.addressID;
    if (!isVerifyView || !rootFingerprint || !selectedAddressID) {
      return;
    }

    if (verifyStateRef.current !== 'idle') {
      return;
    }

    let cancelled = false;
    skipInitiatedRef.current = false;

    const runVerify = async () => {
      setVerifyError(null);
      setVerifyState('connecting');
      const verifyResult = await verifyAddressWithDevice({
        code,
        addressID: selectedAddressID,
        rootFingerprint,
        onSecureVerificationStart: () => {
          if (!cancelled) {
            setVerifyState('verifying');
          }
        },
      });

      if (cancelled || skipInitiatedRef.current) {
        return;
      }
      handleVerifyAddressWithDeviceResult(verifyResult, {
        onUserAbort: () => returnToList(selectedAddressID),
        onConnectFailed: () => {
          setVerifyState('connectFailed');
          setVerifyError(t('addresses.verifyConnectFailed'));
        },
        onSkipDeviceVerification: () => setVerifyState('skipWarning'),
        onVerified: () => returnToList(selectedAddressID),
        onVerifyFailed: () => {
          setVerifyState('error');
          setVerifyError(t('addresses.verifyFailed'));
        },
      });
    };

    void runVerify();

    return () => {
      cancelled = true;
      cancelConnectKeystore();
    };
  }, [code, isVerifyView, rootFingerprint, returnToList, selectedAddress?.addressID, t, verifyAttempt]);

  const resetAndRetry = useCallback(() => {
    setVerifyError(null);
    setVerifyState('idle');
    setVerifyAttempt(prev => prev + 1);
  }, []);

  const startVerifyFlow = useCallback((selectedAddressID: string) => {
    resetAndRetry();
    navigate(`/account/${code}/addresses/${selectedAddressID}/verify`);
  }, [code, navigate, resetAndRetry]);

  const skipVerify = useCallback(() => {
    setVerifyState('skipped');
  }, []);

  return {
    verifyState,
    verifyError,
    hasSkipDeviceVerificationQuery,
    startVerifyFlow,
    retryVerify: resetAndRetry,
    skipVerify,
  };
};
