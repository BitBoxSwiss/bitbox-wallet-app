// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';

export const AddressesGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.addresses')}>
      <Entry key="guide.addresses.whatAreUsedAddresses" entry={t('guide.addresses.whatAreUsedAddresses', { returnObjects: true })} />
      <Entry key="guide.addresses.whyUsedAddresses" entry={t('guide.addresses.whyUsedAddresses', { returnObjects: true })} />
      <Entry key="guide.addresses.canReceiveOnUsed" entry={t('guide.addresses.canReceiveOnUsed', { returnObjects: true })} />
      <Entry key="guide.receive.signMessage" entry={t('guide.receive.signMessage', { returnObjects: true })} />
      <Entry key="guide.receive.whySignMessage" entry={t('guide.receive.whySignMessage', { returnObjects: true })} />
    </Guide>
  );
};
