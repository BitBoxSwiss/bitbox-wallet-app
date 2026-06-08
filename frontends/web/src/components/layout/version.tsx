// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLoad } from '@/hooks/api';
import { getVersion } from '@/api/version';

const Version = () => {
  const { t } = useTranslation();
  const version = useLoad(getVersion);

  if (!version) {
    return null;
  }
  return <p>{t('footer.appVersion')} {version}</p>;
};

export { Version };
