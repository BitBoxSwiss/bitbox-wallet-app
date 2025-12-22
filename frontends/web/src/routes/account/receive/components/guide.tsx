// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { getGuideEntry } from '@/utils/i18n-helpers';

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
      <Entry key="guide.receive.address" entry={getGuideEntry(t, 'guide.receive.address')} />
      <Entry key="guide.receive.whyVerify" entry={getGuideEntry(t, 'guide.receive.whyVerify')} />
      <Entry key="guide.receive.howVerify" entry={getGuideEntry(t, 'guide.receive.howVerify')} />
      <Entry key="guide.receive.plugout" entry={getGuideEntry(t, 'guide.receive.plugout')} />
      {hasMultipleAddresses && (
        <>
          <Entry key="guide.receive.whyMany" entry={getGuideEntry(t, 'guide.receive.whyMany')} />
          <Entry key="guide.receive.why20" entry={getGuideEntry(t, 'guide.receive.why20')} />
          <Entry key="guide.receive.addressChange" entry={getGuideEntry(t, 'guide.receive.addressChange')} />
          {hasDifferentFormats && (
            <Entry key="guide.receive.addressFormats" entry={getGuideEntry(t, 'guide.receive.addressFormats')} />
          )}
        </>
      )}
    </Guide>
  );
};
