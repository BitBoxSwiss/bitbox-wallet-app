/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
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
import style from './payments.module.css';
import { Payment as LightningPayment } from '../../../api/lightning';
import { Payment } from './payment';

type TProps = {
  payments?: LightningPayment[];
};

export const Payments = ({ payments }: TProps) => {
  const { t } = useTranslation();

  return (
    <div className={style.container}>
      <div className="flex flex-row flex-between flex-items-center">
        <label className="labelXLarge">{t('lightning.payments.title')}</label>
      </div>
      <div className={[style.columns, style.headers, style.showOnMedium].join(' ')}>
        <div className={style.type}>{t('lightning.payments.header.type')}</div>
        <div className={style.date}>{t('lightning.payments.header.date')}</div>
        <div className={style.activity}>{t('lightning.payments.header.description')}</div>
        <div className={style.currency}>{t('lightning.payments.header.amount')}</div>
      </div>
      {payments && payments.length > 0 ? (
        payments.map((payment, index) => (
          <Payment key={payment.id} index={index} payment={payment} />
        ))
      ) : (
        <div className={`flex flex-row flex-center ${style.empty}`}>
          <p>{t('lightning.payments.placeholder')}</p>
        </div>
      )}
    </div>
  );
};
