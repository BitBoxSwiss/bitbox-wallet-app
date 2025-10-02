/**
 * Copyright 2025 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import type { AccountCode } from '@/api/account';
import type { TDevices } from '@/api/devices';
import { useSDCard } from '@/hooks/sdcard';
import { Status } from '@/components/status/status';

type Props = {
  code?: AccountCode;
  devices: TDevices;
}

export const SDCardWarning = ({
  code,
  devices,
}: Props) => {
  const { t } = useTranslation();
  const hasCard = useSDCard(devices, code ? [code] : undefined);

  return (
    <Status hidden={!hasCard} type="warning">
      {t('warning.sdcard')}
    </Status>
  );
};
