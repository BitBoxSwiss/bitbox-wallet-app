// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ActionButtons } from './action-buttons';

describe('ActionButtons', () => {
  it('keeps receive available and disables top up when the balance limit is reached', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <ActionButtons accountDataLoaded canTopUp={false} />
      </MemoryRouter>
    );

    expect(container.querySelector('a[href="/lightning/receive"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/lightning/topup"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'lightning.topUp.action' })).toBeDisabled();

    rerender(
      <MemoryRouter>
        <ActionButtons accountDataLoaded canTopUp />
      </MemoryRouter>
    );

    expect(container.querySelector('a[href="/lightning/topup"]')).toBeInTheDocument();
  });
});
