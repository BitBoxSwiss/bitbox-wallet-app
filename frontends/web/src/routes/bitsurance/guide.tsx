// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';

const getLink = () => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return 'https://www.bitsurance.io/de/bitbox/';
  default:
    return 'https://www.bitsurance.io/en/bitbox/';
  }
};

const getPrivacyPolicyLink = () => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return 'https://www.bitsurance.io/datenschutz/';
  default:
    return 'https://www.bitsurance.io/en/dataprotection/';
  }
};

export const BitsuranceGuide = () => {
  const { t } = useTranslation();

  return (
    <Guide title={t('guide.guideTitle.insurance')}>
      <Entry key="guide.bitsurance.why" entry={{
        text: t('guide.bitsurance.why.text'),
        title: t('guide.bitsurance.why.title'),
      }} shown={true} />
      <Entry key="guide.bitsurance.who" entry={{
        text: t('guide.bitsurance.who.text'),
        title: t('guide.bitsurance.who.title'),
      }} />
      <Entry key="guide.bitsurance.what" entry={{
        text: t('guide.bitsurance.what.text'),
        title: t('guide.bitsurance.what.title'),
      }} />
      <Entry key="guide.bitsurance.status" entry={{
        text: t('guide.bitsurance.status.text'),
        title: t('guide.bitsurance.status.title'),
      }} />
      <Entry key="guide.bitsurance.renew" entry={{
        text: t('guide.bitsurance.renew.text'),
        title: t('guide.bitsurance.renew.title'),
      }} />

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
            text: 'service@bitsurance.io',
          },
        }}
      />
    </Guide>
  );
};
