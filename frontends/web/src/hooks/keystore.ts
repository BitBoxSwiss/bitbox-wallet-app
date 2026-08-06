// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState } from 'react';
import {
  connectAnyKeystore,
  connectKeystore,
  TKeystoreFeature,
} from '@/api/keystores';

export const useFeatureConnect = () => {
  const [firmwareUpgradeRequired, setFirmwareUpgradeRequired] = useState(false);

  const handleResult = useCallback((result: Awaited<ReturnType<typeof connectKeystore>>) => {
    if (result.errorCode === 'firmwareUpgradeRequired') {
      setFirmwareUpgradeRequired(true);
    }
    return result.success;
  }, []);

  const connect = useCallback(async (
    rootFingerprint: string,
    requiredFeature?: TKeystoreFeature,
  ) => {
    return handleResult(await connectKeystore(rootFingerprint, requiredFeature));
  }, [handleResult]);

  const connectAny = useCallback(async (requiredFeature?: TKeystoreFeature) => {
    return handleResult(await connectAnyKeystore(requiredFeature));
  }, [handleResult]);

  const dismissFirmwareUpgrade = useCallback(() => {
    setFirmwareUpgradeRequired(false);
  }, []);

  return {
    connect,
    connectAny,
    dismissFirmwareUpgrade,
    firmwareUpgradeRequired,
  };
};
