/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
