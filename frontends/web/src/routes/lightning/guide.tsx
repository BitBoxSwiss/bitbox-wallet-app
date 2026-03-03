// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TEntryProp } from '../../components/guide/entry';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';

export const LightningGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide>
      <Entry key="privateKey" entry={t('guide.lightning.privateKey', { returnObjects: true }) as unknown as TEntryProp} />
      <Entry key="securedByBitBox" entry={t('guide.lightning.securedByBitBox', { returnObjects: true }) as unknown as TEntryProp} />
      <Entry key="multipleDevices" entry={t('guide.lightning.multipleDevices', { returnObjects: true }) as unknown as TEntryProp} />
      <Entry key="multipleWallets" entry={t('guide.lightning.multipleWallets', { returnObjects: true }) as unknown as TEntryProp} />
      <Entry key="providers" entry={t('guide.lightning.providers', { returnObjects: true }) as unknown as TEntryProp} />
    </Guide>
  );
};
