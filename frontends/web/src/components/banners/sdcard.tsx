// SPDX-License-Identifier: Apache-2.0

import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TDevices } from '@/api/devices';
import type { KeysOf } from '@/utils/types';
import { useSDCard } from '@/hooks/sdcard';
import { Message } from '@/components/message/message';

type Props = {
  devices: TDevices;
};

export const SDCardWarning = ({
  devices,
}: Props) => {
  const { t } = useTranslation();
  const { key: locationKey } = useLocation();
  const hasCard = useSDCard(devices, [locationKey]);

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
