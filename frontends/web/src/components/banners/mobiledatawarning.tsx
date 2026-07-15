// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useSubscribe } from '@/hooks/api';
import { subscribeUsingMobileData } from '@/api/mobiledata';
import { Status } from '@/components/status/status';

export const MobileDataWarning = () => {
  const { t } = useTranslation();
  const isUsingMobileData = useSubscribe(subscribeUsingMobileData);
  if (isUsingMobileData === undefined) {
    return null;
  }
  return (
    <Status
      dismissibleKey="mobile-data-warning"
      type="warning"
      hidden={!isUsingMobileData}>
      {t('mobile.usingMobileDataWarning')}
    </Status>
  );
};
