// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';

const getLink = () => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return 'https://www.bitsurance.eu/de/bitbox/';
  default:
    return 'https://www.bitsurance.eu/en/bitbox/';
  }
};

const getPrivacyPolicyLink = () => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return 'https://www.bitsurance.eu/datenschutz/';
  default:
    return 'https://www.bitsurance.eu/en/dataprotection/';
  }
};

export const BitsuranceGuide = () => {
  const { t } = useTranslation();

  return (
    <Guide title={t('guide.guideTitle.insurance')}>
      <Entry key="guide.bitsurance.why" entry={t('guide.bitsurance.why', { returnObjects: true })} shown={true} />
      <Entry key="guide.bitsurance.who" entry={t('guide.bitsurance.who', { returnObjects: true })} />
      <Entry key="guide.bitsurance.what" entry={t('guide.bitsurance.what', { returnObjects: true })} />
      <Entry key="guide.bitsurance.status" entry={t('guide.bitsurance.status', { returnObjects: true })} />
      <Entry key="guide.bitsurance.renew" entry={t('guide.bitsurance.renew', { returnObjects: true })} />

      <Entry key="guide.bitsurance.privacy" entry={{
        link: {
          text: t('guide.bitsurance.privacy.link.text'),
          url: getPrivacyPolicyLink(),
        },
        text: t('guide.bitsurance.privacy.text'),
        title: t('guide.bitsurance.privacy.title'),
      }} />
      <Entry key="guide.bitsurance.faq" entry={{
        link: {
          text: t('guide.bitsurance.faq.link.text'),
          url: getLink(),
        },
        text: t('guide.bitsurance.faq.text'),
        title: t('guide.bitsurance.faq.title'),
      }} />
      <Entry
        key="guide.appendix.questionService"
        entry={{
          title: t('guide.appendix.questionService', { serviceName: 'Bitsurance' }),
          text: t('guide.appendix.textService', { serviceName: 'Bitsurance' }),
          link: {
            text: 'service@bitsurance.eu',
          },
        }}
      />
    </Guide>
  );
};
