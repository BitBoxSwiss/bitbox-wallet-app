// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { TAccount } from '@/api/account';
import { isBitcoinOnly } from '@/routes/account/utils';

type TAddAccountGuide = {
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

export const AddAccountGuide = ({ accounts }: TAddAccountGuide) => {
  const { t } = useTranslation();
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  return (
    <Guide>
      <Entry key="whatAreAccounts" entry={t('guide.accounts.whatAreAccounts', { returnObjects: true })} />
      <Entry key="whyIsThisUseful" entry={t('guide.accounts.whyIsThisUseful', { returnObjects: true })} />
      <Entry key="recoverAccounts" entry={t('guide.accounts.recoverAccounts', { returnObjects: true })} />
      <Entry key="moveFunds" entry={t('guide.accounts.moveFunds', { returnObjects: true })} />
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
          <Entry key="howtoAddTokens" entry={t('guide.accounts.howtoAddTokens', { returnObjects: true })} />
        </>
      )}
      <Entry key="howManyAccounts" entry={t('guide.accounts.howManyAccounts', { returnObjects: true })} />
    </Guide>
  );
};
