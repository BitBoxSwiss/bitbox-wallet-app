/**
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

import { render } from '@testing-library/react';
import { IBalance } from '../../api/account';
import I18NWrapper from '../../i18n/forTests/i18nwrapper';
import { Balance } from './balance';

describe('components/balance/balance', () => {
  it('renders balance properly', () => {
    const MOCK_BALANCE: IBalance = {
      hasAvailable: true,
      hasIncoming: true,
      available: {
        amount: '0.005',
        unit: 'BTC'
      },
      incoming: {
        amount: '0.003',
        unit: 'BTC',
        conversions: {
          BTC: '0.003',
          AUD: '512',
          BRL: '512',
          CAD: '512',
          CHF: '512',
          CNY: '512',
          CZK: '512',
          EUR: '512',
          GBP: '512',
          HKD: '512',
          ILS: '512',
          JPY: '512',
          KRW: '512',
          NGN: '512',
          NOK: '512',
          PLN: '512',
          RUB: '512',
          SEK: '512',
          SGD: '512',
          ZAR: '512',
          USD: '512',
        }
      }
    };
    const { getByTestId } = render(<Balance balance={MOCK_BALANCE} />, { wrapper: I18NWrapper });
    expect(getByTestId('availableBalance')).toHaveTextContent('0.005BTC');
    expect(getByTestId('incomingBalance')).toHaveTextContent('+0.003 BTC / 512 USD');
  });
});
