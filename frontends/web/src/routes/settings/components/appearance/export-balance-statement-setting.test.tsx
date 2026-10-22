// SPDX-License-Identifier: Apache-2.0

import i18n from '../../../../../__mocks__/i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TAccount } from '@/api/account';
import { exportBalanceStatement } from '@/api/backend';
import { alertUser } from '@/components/alert/Alert';
import { BackButtonContext } from '@/contexts/BackButtonContext';
import en from '@/locales/en/app.json';
import { ExportBalanceStatementSetting } from './export-balance-statement-setting';

vi.mock('@/api/backend', () => ({
  exportBalanceStatement: vi.fn(),
}));

vi.mock('@/components/alert/Alert', () => ({
  alertUser: vi.fn(),
}));

i18n.addResourceBundle('en', 'translation', en);

const account: TAccount = {
  active: true,
  code: 'v0-55555555-sepeth-0',
  coinCode: 'sepeth',
  coinName: 'Ethereum Sepolia',
  coinUnit: 'SEPETH',
  name: 'Sepolia account',
  isToken: false,
  blockExplorerTxPrefix: 'https://sepolia.etherscan.io/tx/',
  keystore: {
    connected: true,
    lastConnected: '',
    name: 'BitBox02',
    rootFingerprint: '55555555',
    watchonly: false,
  },
};

describe('ExportBalanceStatementSetting', () => {
  // Unsupported Sepolia exports must show the translated explanation instead of
  // a provider error, keeping the selection dialog open so other accounts can be chosen.
  it('explains why Sepolia exports are unavailable', async () => {
    vi.mocked(exportBalanceStatement).mockResolvedValue({
      success: false,
      aborted: false,
      errorCode: 'sepoliaBalanceStatementUnsupported',
      message: 'Error! Missing Or invalid Action name',
    });
    const user = userEvent.setup();
    render(
      <BackButtonContext.Provider value={{ pushHandler: vi.fn(), popHandler: vi.fn() }}>
        <ExportBalanceStatementSetting accounts={[account]} />
      </BackButtonContext.Provider>
    );

    await user.click(screen.getByRole('button', { name: /Export statement of balance/ }));
    await user.click(screen.getByRole('button', { name: 'Generate PDF' }));

    await waitFor(() => {
      expect(alertUser).toHaveBeenCalledWith(
        en.settings.balanceStatement.export.errors.sepoliaBalanceStatementUnsupported
      );
    });
    expect(screen.getByRole('heading', { name: 'Export statement of balance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate PDF' })).toBeEnabled();
  });
});
