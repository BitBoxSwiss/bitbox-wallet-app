/**
 * Copyright 2022-2024 Shift Crypto AG
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
import type { TExchangeName } from '@/api/exchanges';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';

interface BuyGuideProps {
  exchange?: TExchangeName;
  translationContext: 'bitcoin' | 'crypto';
}

export const ExchangeGuide = ({ exchange, translationContext }: BuyGuideProps) => {
  const { t } = useTranslation();

  const pocketLink = {
    text: t('exchange.pocket.terms.dataprotection.link'),
    url: 'https://pocketbitcoin.com/policy/privacy',
  };

  const moonpayLink = {
    text: t('buy.info.disclaimer.privacyPolicy'),
    url: 'https://www.moonpay.com/privacy_policy',
  };

  const privacyLink = exchange === 'pocket' ? pocketLink : moonpayLink;

  return (
    <Guide title={t('guide.guideTitle.buySell')}>
      <Entry key="guide.buy.protection" entry={{
        link: exchange ? privacyLink : undefined,
        text: t('buy.info.disclaimer.protection.descriptionGeneric', { context: translationContext }),
        title: t('buy.info.disclaimer.protection.title'),
      }} />
    </Guide>
  );
};
