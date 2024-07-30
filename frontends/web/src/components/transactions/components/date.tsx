/**
 * Copyright 2024 Shift Crypto AG
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
import { parseTimeShort } from '@/utils/date';
import { TxDetail } from './detail';
import transactionsStyle from '@/components/transactions/transactions.module.css';
import parentStyle from '@/components/transactions/transaction.module.css';

type TProps = {
  time: string | null;
}

export const TxDate = ({ time }: TProps) => {
  const { i18n, t } = useTranslation();
  const shortDate = time ? parseTimeShort(time, i18n.language) : '---';
  return (
    <div className={transactionsStyle.date}>
      <span className={parentStyle.columnLabel}>
        {t('transaction.details.date')}:
      </span>
      <span className={parentStyle.date}>{shortDate}</span>
    </div>
  );
};

export const TxDateDetail = ({ time }: TProps) => {
  const { i18n, t } = useTranslation();
  const shortDate = time ? parseTimeShort(time, i18n.language) : '---';
  return (
    <TxDetail
      label={t('transaction.details.date')}>
      {shortDate}
    </TxDetail>
  );
};
