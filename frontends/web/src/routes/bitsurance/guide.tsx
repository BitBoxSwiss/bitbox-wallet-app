// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { getGuideEntry } from '@/utils/i18n-helpers';

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
      <Entry key="guide.bitsurance.why" entry={getGuideEntry(t, 'guide.bitsurance.why')} shown={true} />
      <Entry key="guide.bitsurance.who" entry={getGuideEntry(t, 'guide.bitsurance.who')} />
      <Entry key="guide.bitsurance.what" entry={getGuideEntry(t, 'guide.bitsurance.what')} />
      <Entry key="guide.bitsurance.status" entry={getGuideEntry(t, 'guide.bitsurance.status')} />
      <Entry key="guide.bitsurance.renew" entry={getGuideEntry(t, 'guide.bitsurance.renew')} />

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
