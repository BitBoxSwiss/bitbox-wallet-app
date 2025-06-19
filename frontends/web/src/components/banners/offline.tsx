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
import { Status } from '@/components/status/status';
import { getOnline, syncOnline } from '@/api/online';
import { useSync } from '@/hooks/api';

export const Offline = () => {
  const { t } = useTranslation();
  const online = useSync(getOnline, syncOnline);

  if (online === undefined || online === null) {
    return null;
  }

  if (!online.success || online.online) {
    return null;
  }

  return (
    <Status type="warning">
      {t('warning.offline')}
    </Status>
  );
};
