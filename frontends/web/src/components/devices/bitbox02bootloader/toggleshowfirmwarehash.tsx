/**
 * Copyright 2018 Shift Devices AG
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

import { ChangeEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { load } from '../../../decorators/load';
import { apiPost } from '../../../utils/request';
import { Toggle } from '../../toggle/toggle';

type TToggleProps = {
    deviceID: string;
}

type TLoadedProps = {
    enabled: boolean;
}

type TProps = TToggleProps & TLoadedProps;

const ToggleFWHash = ({ enabled, deviceID }: TProps) => {
  const { t } = useTranslation();
  const [enabledState, setEnabledState] = useState<boolean>(enabled);

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const enabled: boolean = event.target.checked;
    apiPost(
      'devices/bitbox02-bootloader/' + deviceID + '/set-firmware-hash-enabled',
      enabled,
    );
    setEnabledState(enabled);
  };

  return (
    <div className="box slim divide">
      <div className="flex flex-row flex-between flex-items-center">
        <p className="m-none">{t('bb02Bootloader.advanced.toggleShowFirmwareHash')}</p>
        <Toggle
          checked={enabledState}
          id="togggle-show-firmware-hash"
          onChange={handleToggle}
          className="text-medium" />
      </div>
    </div>
  );
};

const HOC = load<TLoadedProps, TToggleProps>(({ deviceID }) => ({ enabled: 'devices/bitbox02-bootloader/' + deviceID + '/show-firmware-hash-enabled' }))(ToggleFWHash);
export { HOC as ToggleShowFirmwareHash };
