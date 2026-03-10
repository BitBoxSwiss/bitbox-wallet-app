// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import { connectKeystore } from '@/api/keystores';

type TUseKeystoreConnectionParams = {
  enabled: boolean;
  rootFingerprint?: string;
  onUserAbort?: () => void;
  onError?: (error: unknown) => void;
};

type TUseKeystoreConnectionResult = {
  connected: boolean;
  connecting: boolean;
  retry: () => Promise<void>;
};

const isUserAbort = (success: boolean, errorCode?: string): boolean => {
  return !success && errorCode === 'userAbort';
};

export const useKeystoreConnection = ({
  enabled,
  rootFingerprint,
  onUserAbort,
  onError,
}: TUseKeystoreConnectionParams): TUseKeystoreConnectionResult => {
  const [connected, setConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);

  // Use refs for callbacks to keep `connect` identity stable regardless of
  // whether the caller provides inline arrow functions.
  const onUserAbortRef = useRef(onUserAbort);
  onUserAbortRef.current = onUserAbort;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const connect = useCallback(async (isCancelled?: () => boolean) => {
    if (!enabled || !rootFingerprint) {
      if (!isCancelled?.()) {
        setConnecting(false);
        setConnected(false);
      }
      return;
    }

    setConnecting(true);
    try {
      const connectResult = await connectKeystore(rootFingerprint);
      if (isCancelled?.()) {
        return;
      }

      if (isUserAbort(connectResult.success, connectResult.errorCode)) {
        setConnected(false);
        onUserAbortRef.current?.();
        return;
      }

      setConnected(connectResult.success);
    } catch (err) {
      if (!isCancelled?.()) {
        setConnected(false);
        onErrorRef.current?.(err);
      }
    } finally {
      if (!isCancelled?.()) {
        setConnecting(false);
      }
    }
  }, [enabled, rootFingerprint]);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !rootFingerprint) {
      setConnecting(false);
      setConnected(false);
      return;
    }

    let cancelled = false;
    void connect(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [connect, enabled, rootFingerprint]);

  const retry = useCallback(async () => {
    await connect(() => !mountedRef.current);
  }, [connect]);

  return {
    connected,
    connecting,
    retry,
  };
};
