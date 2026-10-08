// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Route, Switch } from 'wouter';
import { MemoryRouter } from '@/utils/test-helpers';
import { SendResult } from './result';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('warns about an uncertain submission and directs the user to history', () => {
  render(
    <MemoryRouter initialEntries={['/send']}>
      <Switch>
        <Route path="/send" component={() => (
          <SendResult
            code="eth"
            result={{ success: false, errorCode: 'broadcastUncertain' }}
            onContinue={vi.fn()}
            onRetry={vi.fn()}
          />
        )} />
        <Route path="/account/eth" component={() => <p>Account history</p>} />
      </Switch>
    </MemoryRouter>,
  );

  expect(screen.getByText('send.error.broadcastUncertain')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'send.edit' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'button.done' }));
  expect(screen.getByText('Account history')).toBeInTheDocument();
});
