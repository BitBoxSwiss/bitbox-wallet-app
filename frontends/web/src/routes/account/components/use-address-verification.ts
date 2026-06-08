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
  startCopyOnlyFlow: (addressID: string) => void;
  startVerifyFlow: (addressID: string) => void;
  retryVerify: () => void;
  skipVerify: () => void;
};

const COPY_ONLY_PARAM = 'copyOnly';

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
  const hasCopyOnlyQuery = isVerifyView
    && new URLSearchParams(location.search).get(COPY_ONLY_PARAM) === '1';

  useEffect(() => {
    verifyStateRef.current = verifyState;
  }, [verifyState]);

  // Handle route query params before the verify effect so we can enter a
  // non-verifying state without touching the device connection flow.
  useEffect(() => {
    if (!hasCopyOnlyQuery) {
      return;
    }
    skipInitiatedRef.current = true;
    verifyStateRef.current = 'skipped';
    setVerifyError(null);
    setVerifyState('skipped');
    const params = new URLSearchParams(location.search);
    params.delete(COPY_ONLY_PARAM);
    const search = params.toString();
    navigate({
      pathname: location.pathname,
      search: search ? `?${search}` : '',
    }, { replace: true });
  }, [hasCopyOnlyQuery, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!hasSkipDeviceVerificationQuery) {
      return;
    }
    skipInitiatedRef.current = true;
    verifyStateRef.current = 'skipWarning';
    setVerifyError(null);
    setVerifyState('skipWarning');
    const params = new URLSearchParams(location.search);
    params.delete(SKIP_DEVICE_VERIFICATION_PARAM);
    const search = params.toString();
    navigate({
      pathname: location.pathname,
      search: search ? `?${search}` : '',
    }, { replace: true });
  }, [hasSkipDeviceVerificationQuery, location.pathname, location.search, navigate]);

  useEffect(() => {
    const selectedAddressID = selectedAddress?.addressID;
    if (
      !isVerifyView
      || !rootFingerprint
      || !selectedAddressID
      || hasCopyOnlyQuery
      || hasSkipDeviceVerificationQuery
    ) {
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
  }, [
    code,
    hasCopyOnlyQuery,
    hasSkipDeviceVerificationQuery,
    isVerifyView,
    rootFingerprint,
    returnToList,
    selectedAddress?.addressID,
    t,
    verifyAttempt,
  ]);

  const resetAndRetry = useCallback(() => {
    verifyStateRef.current = 'idle';
    setVerifyError(null);
    setVerifyState('idle');
    setVerifyAttempt(prev => prev + 1);
  }, []);

  const startCopyOnlyFlow = useCallback((selectedAddressID: string) => {
    resetAndRetry();
    navigate(`/account/${code}/addresses/${selectedAddressID}/verify?${COPY_ONLY_PARAM}=1`, { replace: true });
  }, [code, navigate, resetAndRetry]);

  const startVerifyFlow = useCallback((selectedAddressID: string) => {
    resetAndRetry();
    navigate(`/account/${code}/addresses/${selectedAddressID}/verify`, { replace: true });
  }, [code, navigate, resetAndRetry]);

  const skipVerify = useCallback(() => {
    verifyStateRef.current = 'skipped';
    setVerifyState('skipped');
  }, []);

  return {
    verifyState,
    verifyError,
    hasSkipDeviceVerificationQuery,
    startCopyOnlyFlow,
    startVerifyFlow,
    retryVerify: resetAndRetry,
    skipVerify,
  };
};
