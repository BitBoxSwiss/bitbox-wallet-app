// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useSync } from '@/hooks/api';
import { getUsingMobileData, subscribeUsingMobileData } from '@/api/mobiledata';
import { Status } from '@/components/status/status';

export const MobileDataWarning = () => {
  const { t } = useTranslation();
  const isUsingMobileData = useSync(getUsingMobileData, subscribeUsingMobileData);
  if (isUsingMobileData === undefined) {
    return null;
  }
  return (
    <Status
      dismissible="mobile-data-warning"
      type="warning"
      hidden={!isUsingMobileData}>
      {t('mobile.usingMobileDataWarning')}
    </Status>
  );
};
