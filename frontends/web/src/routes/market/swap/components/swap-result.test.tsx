// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { SwapResult } from './swap-result';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('directs an uncertain swap to the sell history without offering another payment', () => {
  render(
    <MemoryRouter initialEntries={['/swap']}>
      <Routes>
        <Route path="/swap" element={
          <SwapResult
            buyAccountCode="btc"
            sellAccountCode="eth"
            buyEthAccountCode={undefined}
            result={{ success: false, errorCode: 'broadcastUncertain' }}
            onContinue={vi.fn()}
          />
        } />
        <Route path="/account/eth" element={<p>Sell account history</p>} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByText('send.error.broadcastUncertain')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'send.edit' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'button.done' }));
  expect(screen.getByText('Sell account history')).toBeInTheDocument();
});
