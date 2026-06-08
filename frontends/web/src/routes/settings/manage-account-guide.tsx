// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { TAccount } from '@/api/account';
import { isBitcoinOnly } from '@/routes/account/utils';

type TAccountGuide = {
  accounts: TAccount[];
};

const getCoinsLink = () => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return 'https://bitbox.swiss/de/coins/';
  case 'es':
    return 'https://bitbox.swiss/es/monedas/';
  default:
    return 'https://bitbox.swiss/coins/';
  }
};

export const AccountGuide = ({ accounts }: TAccountGuide) => {
  const { t } = useTranslation();
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  return (
    <Guide title={t('guide.guideTitle.manageAccount')}>
      <Entry key="whatAreAccounts" entry={{
        text: t('guide.accounts.whatAreAccounts.text'),
        title: t('guide.accounts.whatAreAccounts.title'),
      }} />
      <Entry key="whyIsThisUseful" entry={{
        text: t('guide.accounts.whyIsThisUseful.text'),
        title: t('guide.accounts.whyIsThisUseful.title'),
      }} />
      <Entry key="whatIsRememberWallet" entry={{
        text: t('guide.accounts.whatIsRememberWallet.text'),
        title: t('guide.accounts.whatIsRememberWallet.title'),
      }} />
      <Entry key="recoverAccounts" entry={{
        text: t('guide.accounts.recoverAccounts.text'),
        title: t('guide.accounts.recoverAccounts.title'),
      }} />
      <Entry key="moveFunds" entry={{
        text: t('guide.accounts.moveFunds.text'),
        title: t('guide.accounts.moveFunds.title'),
      }} />
      { !hasOnlyBTCAccounts && (
        <>
          <Entry key="supportedCoins" entry={{
            link: {
              text: t('guide.accounts.supportedCoins.link.text'),
              url: getCoinsLink(),
            },
            text: t('guide.accounts.supportedCoins.text'),
            title: t('guide.accounts.supportedCoins.title'),
          }} />
          <Entry key="howtoAddTokens" entry={{
            text: t('guide.accounts.howtoAddTokens.text'),
            title: t('guide.accounts.howtoAddTokens.title'),
          }} />
        </>
      )}
      <Entry key="howManyAccounts" entry={{
        text: t('guide.accounts.howManyAccounts.text'),
        title: t('guide.accounts.howManyAccounts.title'),
      }} />
    </Guide>
  );
};
