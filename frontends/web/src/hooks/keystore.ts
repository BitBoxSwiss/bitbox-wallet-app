// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  connectAnyKeystore,
  connectKeystore,
  TKeystoreFeature,
} from '@/api/keystores';
import { alertUser } from '@/components/alert/Alert';

export const useFeatureConnect = () => {
  const { t } = useTranslation();
  const [firmwareUpgradeRequired, setFirmwareUpgradeRequired] = useState(false);

  const handleResult = useCallback((result: Awaited<ReturnType<typeof connectKeystore>>) => {
    if (result.errorCode === 'firmwareUpgradeRequired') {
      setFirmwareUpgradeRequired(true);
    } else if (result.errorCode === 'unsupportedFeature') {
      alertUser(t('device.unsupportedFeature'));
    }
    return result.success;
  }, [t]);

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
