// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TVendorName } from '@/api/market';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { BTCDirectOTCTerms, getBTCDirectPrivacyLink } from '@/components/terms/btcdirect-otc-terms';
import { getBitrefillPrivacyLink } from '@/components/terms/bitrefill-terms';
import { PocketOTCTerms, getPocketPrivacyLink } from '@/components/terms/pocket-otc-terms';
import { TermsLink } from '@/components/terms/terms-link';
import { BitrefillGuide } from './bitrefill-guide';

type BuyGuideProps = {
  vendor?: TVendorName;
  translationContext: 'bitcoin' | 'crypto';
  terms?: ReactNode;
  showOTC?: boolean;
};

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
      url: getPocketPrivacyLink()
    });
  case 'bitrefill':
    return ({
      text: t('buy.exchange.infoContent.bitrefill.disclaimer.dataProtection.link'),
      url: getBitrefillPrivacyLink(),
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
  case 'bitrefill':
    return ({
      name: 'Bitrefill',
      text: 'help.bitrefill.com',
      url: 'https://help.bitrefill.com/',
    });
  }
};

export const MarketGuide = ({ vendor, translationContext, terms, showOTC = false }: BuyGuideProps) => {
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
      {!!vendor && (
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
      )}
      {vendor === 'bitrefill' && <BitrefillGuide />}
      {terms && serviceLink && <TermsLink provider={serviceLink.name}>{terms}</TermsLink>}
      {showOTC && (
        <>
          <TermsLink provider="BTC Direct OTC"><BTCDirectOTCTerms readOnly /></TermsLink>
          <TermsLink provider="Pocket OTC"><PocketOTCTerms readOnly /></TermsLink>
        </>
      )}
    </Guide>
  );
};
