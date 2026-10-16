// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { useLocation } from '@/utils/router-compatability';
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
  const location = useLocation();
  const hasCard = useSDCard(devices, [location.href]);

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
