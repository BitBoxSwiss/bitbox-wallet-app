// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { runningInAndroid } from '@/utils/env';
import { getUpdate, subscribeUpdate } from '@/api/version';
import { Status } from '@/components/status/status';
import { AppDownloadLink } from '@/components/appdownloadlink/appdownloadlink';
import { useSync } from '@/hooks/api';
import style from './update.module.css';

export const Update = () => {
  const { t, i18n } = useTranslation();
  const file = useSync(getUpdate, subscribeUpdate, state => state.revision)?.update;
  if (!file) {
    return null;
  }
  const description = file.descriptionTranslations?.[i18n.resolvedLanguage ?? 'en'] || file.description;
  return (
    <Status dismissibleKey={`update-${file.version}`} type="info">
      {t('app.upgrade', {
        current: file.current,
        version: file.version,
      })}
      {' '}
      {description}
      {' '}
      {/* Don't show download link on Android because they should update from stores */}
      {!runningInAndroid() && <AppDownloadLink className={style.link} />}
    </Status>
  );
};
