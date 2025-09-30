/**
 * Copyright 2022-2025 Shift Crypto AG
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
import type { TVendorName } from '@/api/market';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { getBTCDirectPrivacyLink } from '@/components/terms/btcdirect-otc-terms';

type BuyGuideProps = {
  vendor?: TVendorName;
  translationContext: 'bitcoin' | 'crypto';
}

const usePrivacyLink = (vendor?: TVendorName) => {
  const { t } = useTranslation();
  switch (vendor) {
  case 'btcdirect':
    return ({
      text: t('buy.exchange.infoContent.btcdirect.disclaimer.dataProtection.link'),
      url: getBTCDirectPrivacyLink(),
    });
  case 'moonpay':
    return ({
      text: t('buy.info.disclaimer.privacyPolicy'),
      url: 'https://www.moonpay.com/privacy_policy',
    });
  case 'pocket':
    return ({
      text: t('exchange.pocket.terms.dataprotection.link'),
      url: 'https://pocketbitcoin.com/policy/privacy',
    });
  }
};

const useServiceLink = (vendor?: TVendorName) => {
  switch (vendor) {
  case 'btcdirect':
    return ({
      name: 'BTC Direct',
      text: 'btcdirect.eu/contact',
      url: 'https://btcdirect.eu/contact',
    });
  case 'moonpay':
    return ({
      name: 'MoonPay',
      text: 'support.moonpay.com',
      url: 'https://support.moonpay.com/',
    });
  case 'pocket':
    return ({
      name: 'Pocket Bitcoin',
      text: 'pocketbitcoin.com/contact',
      url: 'https://pocketbitcoin.com/contact',
    });
  }
};

export const MarketGuide = ({ vendor, translationContext }: BuyGuideProps) => {
  const { t } = useTranslation();
  const link = usePrivacyLink(vendor);
  const serviceLink = useServiceLink(vendor);

  return (
    <Guide title={t('guide.guideTitle.buySell')}>
      <Entry key="guide.buy.protection" entry={{
        link,
        text: t('buy.info.disclaimer.protection.descriptionGeneric', { context: translationContext }),
        title: t('buy.info.disclaimer.protection.title'),
      }}
      />
      <Entry
        key="guide.appendix.questionService"
        entry={{
          title: t('guide.appendix.questionService', { serviceName: serviceLink?.name }),
          text: t('guide.appendix.textService', { serviceName: serviceLink?.name }),
          link: {
            text: serviceLink?.text || '',
            url: serviceLink?.url,
          },
        }}
      />
    </Guide>
  );
};
