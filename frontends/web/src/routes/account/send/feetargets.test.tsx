/**
 * Copyright 2020 Shift Crypto AG
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

import '../../../../__mocks__/i18n';
import { describe, expect, it, Mock, vi } from 'vitest';

vi.mock('../../../utils/request', () => ({
  apiGet: vi.fn().mockResolvedValue(''),
}));
vi.mock('../../../i18n/i18n');

import { render, waitFor } from '@testing-library/react';
import { FeeTargets } from './feetargets';
import { apiGet } from '../../../utils/request';

import * as utilsConfig from '../../../utils/config';
const getConfig = vi.spyOn(utilsConfig, 'getConfig');

describe('routes/account/send/feetargets', () => {

  it('should match the snapshot', async () => {
    getConfig.mockReturnValue(Promise.resolve({
      frontend: { expertFee: false }
    }));
    (apiGet as Mock).mockResolvedValue({
      defaultFeeTarget: 'economy',
      feeTargets: [
        { code: 'low' },
        { code: 'economy' },
      ],
    });

    const { container } = render(
      <FeeTargets
        accountCode="btc"
        coinCode="btc"
        disabled={false}
        fiatUnit="USD"
        proposedFee={{
          amount: '1',
          unit: 'ETH',
          conversions: {
            AUD: '0.02',
            BRL: '12900',
            CAD: '0.02',
            CHF: '0.01',
            CNY: '0.08',
            CZK: '0.06',
            EUR: '0.02',
            GBP: '0.02',
            HKD: '19880',
            NOK: '0.02',
            ILS: '0.02',
            JPY: '1.30',
            KRW: '14.43',
            PLN: '2',
            RUB: '0.88',
            SEK: '0.1',
            SGD: '32233',
            USD: '0.02',
            BTC: '0.02',
          },
        }}
        customFee=""
        onCustomFee={vi.fn()}
        onFeeTargetChange={vi.fn()} />,
    );
    waitFor(() => expect(container).toMatchSnapshot());
  });

  it('should match the snapshot with empty feetargets', async () => {
    getConfig.mockReturnValue(Promise.resolve({ frontend: { expertFee: false } }));
    (apiGet as Mock).mockResolvedValue({
      defaultFeeTarget: '',
      feeTargets: [],
    });

    const { container } = render(
      <FeeTargets
        accountCode="eth"
        coinCode="eth"
        disabled={false}
        fiatUnit="EUR"
        customFee=""
        onCustomFee={vi.fn()}
        onFeeTargetChange={vi.fn()} />,
    );
    await waitFor(() => expect(container).toMatchSnapshot());
  });

  it('should call onFeeTargetChange with default', () => new Promise<void>(async done => {
    getConfig.mockReturnValue(Promise.resolve({ frontend: { expertFee: false } }));
    const apiGetMock = (apiGet as Mock).mockResolvedValue({
      defaultFeeTarget: 'normal',
      feeTargets: [
        { code: 'low' },
        { code: 'economy' },
      ],
    });

    const onFeeTargetChangeCB = (code: string) => {
      expect(code).toBe('normal');
      done();
    };

    render(
      <FeeTargets
        accountCode="btc"
        coinCode="btc"
        disabled={false}
        fiatUnit="USD"
        customFee=""
        onCustomFee={vi.fn()}
        onFeeTargetChange={onFeeTargetChangeCB} />,
    );
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
  }));
});
