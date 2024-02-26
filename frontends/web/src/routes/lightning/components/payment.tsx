/**
 * Copyright 2024 Shift Devices AG
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

import parentStyle from './payments.module.css';
import style from './payment.module.css';
import { Payment as LightningPayment, PaymentType } from '../../../api/lightning';
import { ArrowIn, ArrowOut } from './icons';
import { useTranslation } from 'react-i18next';
import { i18n } from '../../../i18n/i18n';
import { useState } from 'react';
import { Amount } from '../../../components/amount/amount';
import { toSat } from '../../../utils/conversion';

type TProps = {
  index: number;
  payment: LightningPayment;
};

export const Payment = ({ index, payment }: TProps) => {
  const { t } = useTranslation();
  const [sign] = useState<string>(payment.paymentType === PaymentType.RECEIVED ? '+' : '-');
  const [paymentDate] = useState<string>(
    new Date(payment.paymentTime * 1000).toLocaleString(i18n.language, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    })
  );

  return (
    <div className={[style.container, index === 0 ? style.first : ''].join(' ')}>
      <div className={[parentStyle.columns, style.row].join(' ')}>
        <div className={parentStyle.columnGroup}>
          <div className={parentStyle.type}>{payment.paymentType === PaymentType.RECEIVED ? <ArrowIn /> : <ArrowOut />}</div>
          <div className={parentStyle.date}>
            <span className={style.columnLabel}>{t('lightning.payments.header.date')}:</span>
            <span className={style.date}>{paymentDate}</span>
          </div>
          <div className={parentStyle.activity}>
            <span className={style.address}>{payment.description || ''}</span>
          </div>
        </div>
        <div className={parentStyle.columnGroup}>
          <div className={`${parentStyle.currency} ${payment.paymentType === PaymentType.RECEIVED ? style.receive : style.send}`}>
            <span className={`${style.amount} ${style.amountOverflow}`} data-unit=" sat">
              {sign}
              <Amount amount={toSat(payment.amountMsat).toString()} unit="sat" />
              <span className={style.currencyUnit}>&nbsp;sat</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
