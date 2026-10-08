// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { Route, Switch } from 'wouter';
import { expect, it, vi } from 'vitest';
import { MemoryRouter } from '@/utils/test-helpers';
import { SwapResult } from './swap-result';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('directs an uncertain swap to the sell history without offering another payment', () => {
  render(
    <MemoryRouter initialEntries={['/swap']}>
      <Switch>
        <Route path="/swap" component={() => (
          <SwapResult
            buyAccountCode="btc"
            sellAccountCode="eth"
            buyEthAccountCode={undefined}
            result={{ success: false, errorCode: 'broadcastUncertain' }}
            onContinue={vi.fn()}
          />
        )} />
        <Route path="/account/eth" component={() => <p>Sell account history</p>} />
      </Switch>
    </MemoryRouter>,
  );

  expect(screen.getByText('send.error.broadcastUncertain')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'send.edit' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'button.done' }));
  expect(screen.getByText('Sell account history')).toBeInTheDocument();
});
