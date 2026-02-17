// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
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
        onUserAbort?.();
        return;
      }

      setConnected(connectResult.success);
    } catch (err) {
      if (!isCancelled?.()) {
        setConnected(false);
        onError?.(err);
      }
    } finally {
      if (!isCancelled?.()) {
        setConnecting(false);
      }
    }
  }, [enabled, onError, onUserAbort, rootFingerprint]);

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
    await connect();
  }, [connect]);

  return {
    connected,
    connecting,
    retry,
  };
};
