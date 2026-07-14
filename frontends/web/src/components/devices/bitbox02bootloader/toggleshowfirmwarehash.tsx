// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad } from '@/hooks/api';
import { getShowFirmwareHash, setShowFirmwareHash } from '@/api/bitbox02bootloader';
import { Toggle } from '@/components/toggle/toggle';

type Props = {
  deviceID: string;
  onError: (message: string | undefined) => void;
};

export const ToggleShowFirmwareHash = ({ deviceID, onError }: Props) => {
  const { t } = useTranslation();
  const [enabledState, setEnabledState] = useState<boolean>(false);
  const enabledConfig = useLoad(useCallback(() => getShowFirmwareHash(deviceID), [deviceID]));

  useEffect(() => {
    if (enabledConfig === undefined) {
      return;
    }
    if (!enabledConfig.success) {
      onError(enabledConfig.errorMessage || t('genericError'));
      return;
    }
    onError(undefined);
    setEnabledState(enabledConfig.enabled);
  }, [enabledConfig, onError, t]);

  const handleToggle = async (event: ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setEnabledState(enabled);
    const result = await setShowFirmwareHash(deviceID, enabled);
    if (!result.success) {
      setEnabledState(!enabled);
      onError(result.errorMessage || t('genericError'));
      return;
    }
    onError(undefined);
  };

  return (
    <div className="flex flex-row flex-between flex-items-center">
      <p className="m-none">{t('bb02Bootloader.advanced.toggleShowFirmwareHash')}</p>
      <Toggle
        checked={enabledState}
        id="togggle-show-firmware-hash"
        onChange={handleToggle} />
    </div>
  );
};
