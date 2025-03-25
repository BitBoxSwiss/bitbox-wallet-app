/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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
import { useSync } from '@/hooks/api';
import { getUsingMobileData, subscribeUsingMobileData } from '@/api/mobiledata';
import { Status } from '@/components/status/status';

export const MobileDataWarning = () => {
  const { t } = useTranslation();
  const isUsingMobileData = useSync(
    getUsingMobileData,
    subscribeUsingMobileData,
  );
  if (isUsingMobileData === undefined) {
    return null;
  }
  return (
    <Status
      dismissible="mobile-data-warning"
      type="warning"
      hidden={!isUsingMobileData}
    >
      {t('mobile.usingMobileDataWarning')}
    </Status>
  );
};
