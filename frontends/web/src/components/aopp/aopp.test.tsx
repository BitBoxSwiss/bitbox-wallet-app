// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Aopp } from './aopp';

const aoppAPIMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  getAOPP: vi.fn(),
  subscribeAOPP: vi.fn(),
}));

vi.mock('@/api/aopp', () => aoppAPIMocks);

describe('components/aopp/aopp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aoppAPIMocks.subscribeAOPP.mockReturnValue(() => {});
  });

  it('renders an error without a callback', async () => {
    aoppAPIMocks.getAOPP.mockResolvedValue({
      state: 'error',
      errorCode: 'aoppInvalidRequest',
      callback: '',
    });

    render(<Aopp />);

    expect(await screen.findByText('error.aoppInvalidRequest')).toBeInTheDocument();
  });
});
