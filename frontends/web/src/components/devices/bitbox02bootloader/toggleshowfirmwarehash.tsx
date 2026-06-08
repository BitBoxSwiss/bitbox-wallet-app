// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad } from '@/hooks/api';
import { getShowFirmwareHash, setShowFirmwareHash } from '@/api/bitbox02bootloader';
import { Toggle } from '@/components/toggle/toggle';

type Props = {
  deviceID: string;
};

export const ToggleShowFirmwareHash = ({ deviceID }: Props) => {
  const { t } = useTranslation();
  const [enabledState, setEnabledState] = useState<boolean>(false);
  const enabledConfig = useLoad(getShowFirmwareHash(deviceID));

  useEffect(() => {
    if (enabledConfig !== undefined) {
      setEnabledState(enabledConfig);
    }
  }, [enabledConfig]);

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setShowFirmwareHash(deviceID, enabled);
    setEnabledState(enabled);
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
