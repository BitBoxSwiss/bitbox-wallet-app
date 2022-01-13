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

import 'jest';

jest.mock('../../../utils/request');
import { apiGet } from '../../../utils/request';

jest.mock('../../../i18n/i18n');
jest.mock('../../../decorators/translate', () => ({
  // this mock makes sure any components using the translate HoC receive the t function as a prop
  translate: () => Component => {
    Component.defaultProps = { ...Component.defaultProps, t: k => k };
    return Component;
  },
}));

jest.mock('../../../../src/decorators/load', () => ({
  load: () => Component => {
    Component.defaultProps = { ...Component.defaultProps, config: { frontend: { } } };
    return Component;
  },
}));

import { FeeTargets } from '../../../routes/account/send/feetargets';
import { mount, shallow } from 'enzyme';

describe('routes/account/send/feetargets', () => {

  it('should match the snapshot', () => {
    (apiGet as jest.Mock).mockResolvedValue({
      defaultFeeTarget: 'economy',
      feeTargets: [
        { code: 'low' },
        { code: 'economy' },
      ],
    });

    const fee = shallow(
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
            EUR: '0.02',
            GBP: '0.02',
            HKD: '19880',
            NOK: '0.02',
            ILS: '0.02',
            JPY: '1.30',
            KRW: '14.43',
            RUB: '0.88',
            SGD: '32233',
            USD: '0.02',
            BTC: '0.02',
          },
        }}
        customFee=""
        onCustomFee={jest.fn()}
        onFeeTargetChange={jest.fn()} />,
    );
    expect(fee).toMatchSnapshot();
  });

  it('should match the snapshot with empty feetargets', () => {
    (apiGet as jest.Mock).mockResolvedValue({
      defaultFeeTarget: '',
      feeTargets: [],
    });

    const fee = mount(
      <FeeTargets
        accountCode="eth"
        coinCode="eth"
        disabled={false}
        fiatUnit="EUR"
        customFee=""
        onCustomFee={jest.fn()}
        onFeeTargetChange={jest.fn()} />,
    );
    expect(fee).toMatchSnapshot();
  });

  it('should call onFeeTargetChange with default', done => {
    const apiGetMock = (apiGet as jest.Mock).mockResolvedValue({
      defaultFeeTarget: 'normal',
      feeTargets: [
        { code: 'low' },
        { code: 'economy' },
      ],
    });

    const onFeeTargetChangeCB = code => {
      expect(code).toBe('normal');
      done();
    };

    shallow(
      <FeeTargets
        accountCode="btc"
        coinCode="btc"
        disabled={false}
        fiatUnit="USD"
        customFee=""
        onCustomFee={jest.fn()}
        onFeeTargetChange={onFeeTargetChangeCB} />,
    );
    expect(apiGetMock).toHaveBeenCalled();
  });
});
