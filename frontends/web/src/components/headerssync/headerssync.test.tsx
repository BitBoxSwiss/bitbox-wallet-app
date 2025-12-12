// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HeadersSync } from './headerssync';
import { TStatus } from '@/api/coins';
import * as apiHooks from '@/hooks/api';
import * as mountHooks from '@/hooks/mount';

const useSubscribeSpy = vi.spyOn(apiHooks, 'useSubscribe');
const useMountedRefSpy = vi.spyOn(mountHooks, 'useMountedRef');

vi.mock('@/utils/request', () => ({
  apiGet: vi.fn().mockResolvedValue(''),
}));

describe('components/headerssync/headerssync', () => {
  beforeEach(() => {
    useMountedRefSpy.mockReturnValueOnce({ current: true });
  });

  it('renders null when subscribe value of null', () => {
    useSubscribeSpy.mockReturnValueOnce(null);

    const { container } = render(<HeadersSync coinCode="btc" />);
    expect(container.firstChild).toBeNull();
  });

  describe('renders proper progress', () => {
    it('has 100% progress', () => {
      const MOCKED_SUBSCRIBE_VALUE: TStatus = {
        tipAtInitTime: 2408855,
        tip: 2408940,
        tipHashHex: '0000000000000015f61742c773181dd368527575a6ac02ea5ecbace8e73cc083',
        targetHeight: 2408940
      };
      useSubscribeSpy.mockReturnValueOnce(MOCKED_SUBSCRIBE_VALUE);

      const { getByTestId } = render(<HeadersSync coinCode="btc" />);
      const progressBar = getByTestId('progress-bar');
      expect(progressBar.firstChild).toHaveStyle('width: 100%');
    });

    it('has 50% progress', () => {
      const MOCKED_SUBSCRIBE_VALUE: TStatus = {
        tipAtInitTime: 2408855,
        tip: 2408897.5,
        tipHashHex: '0000000000000015f61742c773181dd368527575a6ac02ea5ecbace8e73cc083',
        targetHeight: 2408940
      };
      useSubscribeSpy.mockReturnValueOnce(MOCKED_SUBSCRIBE_VALUE);

      const { getByTestId, container } = render(<HeadersSync coinCode="btc" />);
      const progressBar = getByTestId('progress-bar');
      expect(container).toHaveTextContent('50%');
      expect(progressBar.firstChild).toHaveStyle('width: 50%');
    });
  });
});
