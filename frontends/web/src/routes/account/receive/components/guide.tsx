// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';

type Props = {
  hasMultipleAddresses: boolean;
  hasDifferentFormats: boolean;
};

export const ReceiveGuide = ({
  hasMultipleAddresses,
  hasDifferentFormats,
}: Props) => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.receive')}>
      <Entry key="guide.receive.address" entry={t('guide.receive.address', { returnObjects: true })} />
      <Entry key="guide.receive.whyVerify" entry={t('guide.receive.whyVerify', { returnObjects: true })} />
      <Entry key="guide.receive.howVerify" entry={t('guide.receive.howVerify', { returnObjects: true })} />
      <Entry key="guide.receive.plugout" entry={t('guide.receive.plugout', { returnObjects: true })} />
      {hasMultipleAddresses && (
        <>
          <Entry key="guide.receive.whyMany" entry={t('guide.receive.whyMany', { returnObjects: true })} />
          <Entry key="guide.receive.why20" entry={t('guide.receive.why20', { returnObjects: true })} />
          <Entry key="guide.receive.addressChange" entry={t('guide.receive.addressChange', { returnObjects: true })} />
          {hasDifferentFormats && (
            <Entry key="guide.receive.addressFormats" entry={t('guide.receive.addressFormats', { returnObjects: true })} />
          )}
        </>
      )}
      <Entry key="guide.receive.signMessage" entry={t('guide.receive.signMessage', { returnObjects: true })} />
      <Entry key="guide.receive.whySignMessage" entry={t('guide.receive.whySignMessage', { returnObjects: true })} />
    </Guide>
  );
};
