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
      <Entry key="guide.receive.address" entry={{
        text: t('guide.receive.address.text'),
        title: t('guide.receive.address.title'),
      }} />
      <Entry key="guide.receive.whyVerify" entry={{
        text: t('guide.receive.whyVerify.text'),
        title: t('guide.receive.whyVerify.title'),
      }} />
      <Entry key="guide.receive.howVerify" entry={{
        text: t('guide.receive.howVerify.text'),
        title: t('guide.receive.howVerify.title'),
      }} />
      <Entry key="guide.receive.plugout" entry={{
        text: t('guide.receive.plugout.text'),
        title: t('guide.receive.plugout.title'),
      }} />
      {hasMultipleAddresses && (
        <>
          <Entry key="guide.receive.whyMany" entry={{
            text: t('guide.receive.whyMany.text'),
            title: t('guide.receive.whyMany.title'),
          }} />
          <Entry key="guide.receive.why20" entry={{
            text: t('guide.receive.why20.text'),
            title: t('guide.receive.why20.title'),
          }} />
          <Entry key="guide.receive.addressChange" entry={{
            text: t('guide.receive.addressChange.text'),
            title: t('guide.receive.addressChange.title'),
          }} />
          {hasDifferentFormats && (
            <Entry key="guide.receive.addressFormats" entry={{
              text: t('guide.receive.addressFormats.text'),
              title: t('guide.receive.addressFormats.title'),
            }} />
          )}
        </>
      )}
    </Guide>
  );
};
