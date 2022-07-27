/**
 * Copyright 2022 Shift Crypto AG
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
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';

interface BuyGuideProps {
  name: string;
}

export default function BuyGuide({ name }: BuyGuideProps) {
  const { t } = useTranslation();
  return (
    <Guide>
      <Entry key="guide.buy.security" entry={{
        link: {
          text: t('buy.info.disclaimer.security.link'),
          url: 'https://shiftcrypto.ch/bitbox02/threat-model/',
        },
        text: t('buy.info.disclaimer.security.description', { name }),
        title: t('buy.info.disclaimer.security.title'),
      }} shown={true} />
      <Entry key="guide.buy.protection" entry={{
        link: {
          text: t('buy.info.disclaimer.privacyPolicy'),
          url: 'https://www.moonpay.com/privacy_policy',
        },
        text: t('buy.info.disclaimer.protection.description', { name }),
        title: t('buy.info.disclaimer.protection.title'),
      }} />
      <Entry key="guide.buy.exchanges" entry={{
        link: {
          text: t('guide.buy.exchanges.link.text'),
          url: '/exchanges',
        },
        text: t('guide.buy.exchanges.text'),
        title: t('guide.buy.exchanges.title'),
      }} />
    </Guide>
  );
}
