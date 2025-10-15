/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023-2024 Shift Crypto AG
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
import { TBalance } from '@/api/account';
import { Amount } from '@/components/amount/amount';
import { BalanceSkeleton } from '@/components/balance/balance-skeleton';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import style from './balance.module.css';

type TProps = {
  balance?: TBalance;
  noRotateFiat?: boolean;
}

export const Balance = ({
  balance,
  noRotateFiat,
}: TProps) => {
  const { t } = useTranslation();
  if (!balance) {
    return (
      <BalanceSkeleton />
    );
  }

  return (
    <header className={style.balance}>
      <table className={style.balanceTable}>
        <tbody data-testid="availableBalance">
          <AmountWithUnit
            amount={balance.available}
            tableRow
            enableRotateUnit={!noRotateFiat}
          />
          <AmountWithUnit
            amount={balance.available}
            tableRow
            enableRotateUnit={!noRotateFiat}
            convertToFiat
          />
        </tbody>
      </table>
      {
        balance.hasIncoming && (
          <p className={style.pendingBalance}>
            {t('account.incoming')}
            {' '}
            <span data-testid="incomingBalance">
              +<Amount
                amount={balance.incoming.amount}
                unit={balance.incoming.unit}
              />
              {' '}{balance.incoming.unit} /
              <span className={style.incomingConversion}>
                {' '}
                <AmountWithUnit
                  amount={balance.incoming}
                  convertToFiat
                />
              </span>
            </span>
          </p>
        )
      }
    </header>
  );
};
