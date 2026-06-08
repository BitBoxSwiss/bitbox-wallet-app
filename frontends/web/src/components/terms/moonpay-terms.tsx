// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isBitcoinOnly } from '@/routes/account/utils';
import { Button, Checkbox } from '@/components/forms';
import { useConfig } from '@/contexts/ConfigProvider';
import { TAccount } from '@/api/account';
import { Col, Colgroup, Table, Tbody, Td, Th, Thead, Tr } from '@/components/table/table';
import { A } from '@/components/anchor/anchor';
import style from './terms.module.css';

type TProps = {
  account: TAccount;
  onAgreedTerms: () => void;
};

export const MoonpayTerms = ({ account, onAgreedTerms }: TProps) => {
  const { t } = useTranslation();
  const { setConfig } = useConfig();

  const handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
    setConfig({ frontend: { skipMoonpayDisclaimer: e.target.checked } });
  };

  const coinCode = account.coinCode.toUpperCase();
  const isBitcoin = isBitcoinOnly(account.coinCode);

  return (
    <div className={style.disclaimerContainer}>
      <div className={style.disclaimer}>
        <h2 className={style.title}>
          {t('buy.info.disclaimer.title', {
            context: isBitcoin ? 'bitcoin' : 'crypto'
          })}
        </h2>
        <p>{t('buy.info.disclaimer.intro.0', { coinCode })}</p>
        <p>{t('buy.info.disclaimer.intro.1', { coinCode })}</p>
        <h2 className={style.title}>
          {t('buy.info.disclaimer.payment.title')}
        </h2>
        <p>{t('buy.info.disclaimer.payment.details', { coinCode })}</p>
        <Table>
          <Colgroup>
            <Col width="*" />
            <Col width="50px" />
            <Col width="*" />
          </Colgroup>
          <Thead>
            <Tr>
              <Th>{t('buy.info.disclaimer.payment.table.method')}</Th>
              <Th>{t('buy.info.disclaimer.payment.table.fee')}</Th>
              <Th>{t('buy.info.disclaimer.payment.table.description')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>{t('buy.info.disclaimer.payment.table.1_method')}</Td>
              <Td className={style.nowrap}>1.9 %</Td>
              <Td>{t('buy.info.disclaimer.payment.table.1_description')}</Td>
            </Tr>
            <Tr>
              <Td>{t('buy.info.disclaimer.payment.table.2_method')}</Td>
              <Td className={style.nowrap}>4.9 %</Td>
              <Td>{t('buy.info.disclaimer.payment.table.2_description')}</Td>
            </Tr>
          </Tbody>
        </Table>
        <p>{t('buy.info.disclaimer.payment.footnote')}</p>
        <h2 className={style.title}>
          {t('buy.info.disclaimer.security.title')}
        </h2>
        <p>
          {t('buy.info.disclaimer.security.descriptionGeneric', {
            context: isBitcoin ? 'bitcoin' : 'crypto'
          })}
        </p>
        <p>
          <A href="https://bitbox.swiss/bitbox02/threat-model/">
            {t('buy.info.disclaimer.security.link')}
          </A>
        </p>
        <h2 className={style.title}>
          {t('buy.info.disclaimer.protection.title')}
        </h2>
        <p>
          {t('buy.info.disclaimer.protection.descriptionGeneric', {
            context: isBitcoin ? 'bitcoin' : 'crypto'
          })}
        </p>
        <p>
          <A href="https://www.moonpay.com/privacy_policy">
            {t('buy.info.disclaimer.privacyPolicy')}
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
          onClick={onAgreedTerms}>
          {t('buy.info.continue')}
        </Button>
      </div>
    </div>
  );
};
