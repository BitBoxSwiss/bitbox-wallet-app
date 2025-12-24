/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
            text: 'service@bitsurance.eu',
          },
        }}
      />
    </Guide>
  );
};
