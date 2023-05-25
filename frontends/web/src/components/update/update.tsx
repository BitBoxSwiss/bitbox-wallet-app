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
import { runningInAndroid } from '../../utils/env';
import { getUpdate } from '../../api/version';
import { Status } from '../status/status';
import { AppDownloadLink } from '../appdownloadlink/appdownloadlink';
import { useLoad } from '../../hooks/api';

export const Update = () => {
  const { t } = useTranslation();
  const file = useLoad(getUpdate);
  if (!file) {
    return null;
  }
  return (
    <Status dismissible={`update-${file.version}`} type="info">
      {t('app.upgrade', {
        current: file.current,
        version: file.version,
      })}
      {file.description}
      {' '}
      {/* Don't show download link on Android because they should update from stores */}
      {!runningInAndroid() && <AppDownloadLink />}
    </Status>
  );
};
