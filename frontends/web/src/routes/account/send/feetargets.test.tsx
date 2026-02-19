// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { describe, expect, it, Mock, vi } from 'vitest';

vi.mock('@/utils/request', () => ({
  apiGet: vi.fn().mockResolvedValue(''),
}));
vi.mock('@/i18n/i18n');

import { render, waitFor } from '@testing-library/react';
import { FeeTargets } from './feetargets';
import { apiGet } from '@/utils/request';

import * as utilsConfig from '@/utils/config';
const getConfig = vi.spyOn(utilsConfig, 'getConfig');

vi.mock('@/hooks/mediaquery', () => ({
  useMediaQuery: vi.fn().mockReturnValue(true),
  useContext: vi.fn(),
}));

describe('routes/account/send/feetargets', () => {

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
        customFee=""
        onCustomFee={vi.fn()}
        onFeeTargetChange={onFeeTargetChangeCB} />,
    );
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
  }));
});
