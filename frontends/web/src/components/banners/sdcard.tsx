// SPDX-License-Identifier: Apache-2.0

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AccountCode } from '@/api/account';
import type { TDevices } from '@/api/devices';
import type { KeysOf } from '@/utils/types';
import { useSDCard } from '@/hooks/sdcard';
import { Message } from '@/components/message/message';

type Props = {
  code?: AccountCode;
  devices: TDevices;
};

export const SDCardWarning = ({
  code,
  devices,
}: Props) => {
  const { t } = useTranslation();
  const hasCard = useSDCard(devices, code ? [code] : undefined);

  const deviceList: KeysOf<TDevices> = Object.keys(devices);
  const firstDevice = deviceList[0];
  if (!firstDevice) {
    return null;
  }

  return (
    <Message hidden={!hasCard} type="warning">
      {t('warning.sdcard')}
      <br />
      <Link to={`/manage-backups/${firstDevice}`}>
        {t('backup.link')}
      </Link>
    </Message>
  );
};
