// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Entry } from '@/components/guide/entry';
import { i18n } from '@/i18n/i18n';
import { localeMapping } from '@/components/terms/bitrefill-terms';

export const getBitrefillHelpLink = (): string => {
  switch (i18n.resolvedLanguage) {
  case 'es':
    return 'https://help.bitrefill.com/hc/es';
  default:
    return 'https://help.bitrefill.com/';
  }
};

export const getBitrefillLimitsLink = (): string => {
  switch (i18n.resolvedLanguage) {
  case 'es':
    return 'https://help.bitrefill.com/hc/es/articles/360019385360--Existe-un-l%C3%ADmite-de-compra';
  default:
    return 'https://help.bitrefill.com/hc/en-us/articles/360019385360-Is-there-a-purchasing-top-up-limit';
  }
};

const getBitrefillVerificationLink = () => {
  const hl = i18n.resolvedLanguage ? localeMapping[i18n.resolvedLanguage] : 'en';
  return 'https://www.bitrefill.com/account/verification/?hl=' + hl;
};

export const BitrefillGuide = () => {
  const { t } = useTranslation();

  return (
    <>
      <Entry
        key="guide.bitrefill.invoice"
        entry={{
          title: t('guide.bitrefill.invoice.title'),
          text: t('guide.bitrefill.invoice.text'),
          link: {
            text: t('guide.bitrefill.invoice.link.text'),
            url: getBitrefillHelpLink(),
          },
        }}
      />
      <Entry
        key="guide.bitrefill.kyc"
        entry={{
          title: t('guide.bitrefill.kyc.title'),
          text: t('guide.bitrefill.kyc.text'),
          link: {
            text: t('guide.bitrefill.kyc.link.text'),
            url: getBitrefillLimitsLink(),
          },
        }}
      />
      <Entry
        key="guide.bitrefill.limits"
        entry={{
          title: t('guide.bitrefill.limits.title'),
          text: t('guide.bitrefill.limits.text'),
          link: {
            text: t('guide.bitrefill.limits.link.text'),
            url: getBitrefillVerificationLink(),
          },
        }}
      />
    </>
  );
};

