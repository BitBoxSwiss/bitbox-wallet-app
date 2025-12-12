// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { runningInAndroid } from '@/utils/env';
import { getUpdate } from '@/api/version';
import { Status } from '@/components/status/status';
import { AppDownloadLink } from '@/components/appdownloadlink/appdownloadlink';
import { useLoad } from '@/hooks/api';
import style from './update.module.css';

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
      {!runningInAndroid() && <AppDownloadLink className={style.link} />}
    </Status>
  );
};
