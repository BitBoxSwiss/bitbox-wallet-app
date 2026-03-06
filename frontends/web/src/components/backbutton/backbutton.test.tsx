// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/i18n');

const mockNavigate = vi.fn();
const mockUseEsc = vi.fn();

vi.mock('react-router-dom', async () => {
  const reactRouter = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...reactRouter,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/keyboard', () => ({
  useEsc: (handler: () => boolean) => mockUseEsc(handler),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackButton } from './backbutton';

describe('components/backbutton', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseEsc.mockReset();
  });

  it('navigates back by history when no explicit target is provided', async () => {
    const user = userEvent.setup();

    render(<BackButton>Back</BackButton>);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('navigates to explicit target with replace disabled by default', async () => {
    const user = userEvent.setup();

    render(<BackButton to="/account/btc/info">Back</BackButton>);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(mockNavigate).toHaveBeenCalledWith('/account/btc/info', { replace: false });
  });

  it('supports custom replace behavior for explicit targets', async () => {
    const user = userEvent.setup();

    render(<BackButton to="/account/btc/info" replace={true}>Back</BackButton>);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(mockNavigate).toHaveBeenCalledWith('/account/btc/info', { replace: true });
  });

  it('uses custom onBack handler when provided', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <BackButton to="/account/btc/info" onBack={onBack}>
        Back
      </BackButton>
    );

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
