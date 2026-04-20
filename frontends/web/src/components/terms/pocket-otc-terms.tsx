// SPDX-License-Identifier: Apache-2.0

import { type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { setConfig } from '@/utils/config';
import { SimpleMarkup } from '@/utils/markup';
import { LocalizedNumber } from '@/components/amount/amount';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/table/table';
import { Button, Checkbox } from '@/components/forms';
import { A } from '@/components/anchor/anchor';
import style from './terms.module.css';

type TProps = {
  onContinue: () => void;
};

export const getPocketPrivacyLink = () => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return 'https://pocketbitcoin.com/de/policy/privacy?BitBox';
  case 'it':
    return 'https://pocketbitcoin.com/it/policy/privacy?BitBox';
  default:
    return 'https://pocketbitcoin.com/policy/privacy?BitBox';
  }
};

const handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
  setConfig({ frontend: { skipPocketOTCDisclaimer: e.target.checked } });
};

export const PocketOTCTradingVolumeTable = () => {
  const { t } = useTranslation();
  return (
    <Table>
      <Thead>
        <Tr>
          <Th>
            {t('buy.exchange.infoContent.pocket-otc.infobox.tradingVolume')}
          </Th>
          <Th>
            {t('buy.exchange.infoContent.pocket-otc.infobox.transactionFee')}
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        <Tr>
          <Td>
            EUR <LocalizedNumber number="100'000.00" /> +
          </Td>
          <Td>
            <LocalizedNumber number="1.29" />%
          </Td>
        </Tr>
        <Tr>
          <Td>
            EUR <LocalizedNumber number="250'000.00" /> +
          </Td>
          <Td>
            <LocalizedNumber number="1.09" />%
          </Td>
        </Tr>
        <Tr>
          <Td>
            EUR <LocalizedNumber number="500'000.00" /> +
          </Td>
          <Td>
            <LocalizedNumber number="0.89" />%
          </Td>
        </Tr>
        <Tr>
          <Td>
            EUR <LocalizedNumber number="1'000'000.00" /> +
          </Td>
          <Td>
            <LocalizedNumber number="0.69" />%
          </Td>
        </Tr>
      </Tbody>
    </Table>
  );
};

export const PocketOTCTerms = ({ onContinue }: TProps) => {
  const { t } = useTranslation();

  return (
    <div className={style.disclaimerContainer}>
      <div className={style.disclaimer}>
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.pocket-otc.disclaimer.partnership.title')}
        </h2>
        <p>
          {t('buy.exchange.infoContent.pocket-otc.disclaimer.partnership.text')}
        </p>
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.pocket-otc.disclaimer.payment.title')}
        </h2>
        <ul>
          <li>
            <SimpleMarkup key="payment-1" tagName="p" markup={t('buy.exchange.infoContent.pocket-otc.disclaimer.payment.info.0')} />
          </li>
          <li>
            <SimpleMarkup key="payment-2" tagName="p" markup={t('buy.exchange.infoContent.pocket-otc.disclaimer.payment.info.1')} />
          </li>
          <li>
            <SimpleMarkup key="payment-3" tagName="p" markup={t('buy.exchange.infoContent.pocket-otc.disclaimer.payment.info.2')} />
          </li>
        </ul>
        <PocketOTCTradingVolumeTable />
        <br />
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.pocket-otc.disclaimer.security.title')}
        </h2>
        <p>{t('buy.exchange.infoContent.pocket-otc.disclaimer.security.info')}</p>
        <p>
          <A href="https://bitbox.swiss/bitbox02/threat-model/">
            {t('buy.exchange.infoContent.pocket-otc.disclaimer.security.link')}
          </A>
        </p>
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.pocket-otc.disclaimer.kyc.title')}
        </h2>
        <p>
          {t('buy.exchange.infoContent.pocket-otc.disclaimer.kyc.info')}
        </p>
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.pocket-otc.disclaimer.dataProtection.title')}
        </h2>
        <p>{t('buy.exchange.infoContent.pocket-otc.disclaimer.dataProtection.info')}</p>
        <p>
          <A href={getPocketPrivacyLink()}>
            {t('buy.exchange.infoContent.pocket-otc.disclaimer.dataProtection.link')}
          </A>
        </p>
      </div>
      <div className="text-center m-bottom-quarter">
        <Checkbox
          id="skip_disclaimer"
          label={t('buy.info.skip')}
          onChange={handleSkipDisclaimer} />
      </div>
      <div className="buttons text-center m-bottom-xlarge">
        <Button
          primary
          onClick={onContinue}>
          {t('buy.info.continue')}
        </Button>
      </div>
    </div>
  );
};
