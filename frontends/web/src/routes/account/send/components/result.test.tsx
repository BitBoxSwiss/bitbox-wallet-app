// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { SendResult } from './result';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('warns about an uncertain submission and directs the user to history', () => {
  render(
    <MemoryRouter initialEntries={['/send']}>
      <Routes>
        <Route path="/send" element={
          <SendResult
            code="eth"
            result={{ success: false, errorCode: 'broadcastUncertain' }}
            onContinue={vi.fn()}
            onRetry={vi.fn()}
          />
        } />
        <Route path="/account/eth" element={<p>Account history</p>} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByText('send.error.broadcastUncertain')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'send.edit' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'button.done' }));
  expect(screen.getByText('Account history')).toBeInTheDocument();
});
