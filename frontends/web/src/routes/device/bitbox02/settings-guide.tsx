// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';

const getLink = () => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return 'https://bitbox.swiss/de/bitbox02/sicherheit/#device-authenticity-check';
  case 'es':
    return 'https://bitbox.swiss/es/bitbox02/seguridad/#device-authenticity-check';
  default:
    return 'https://bitbox.swiss/bitbox02/security-features/#device-authenticity-check';
  }
};

export const ManageDeviceGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.manageDevice')}>
      <Entry key="whatAreAccounts" entry={{
        text: t('guide.device.name.text'),
        title: t('guide.device.name.title'),
      }} />
      <Entry key="guide.device.secure-chip" entry={{
        link: {
          text: t('guide.device.secure-chip.link.text'),
          url: 'https://bitbox.swiss/blog/bitbox-05-2021-masnee-update/#check-your-secure-chip-variant'
        },
        text: t('guide.device.secure-chip.text'),
        title: t('guide.device.secure-chip.title')
      }} />
      <Entry key="guide.device.attestation" entry={{
        link: {
          text: t('guide.device.attestation.link.text'),
          url: getLink(),
        },
        text: t('guide.device.attestation.text'),
        title: t('guide.device.attestation.title')
      }} />
    </Guide>
  );
};
