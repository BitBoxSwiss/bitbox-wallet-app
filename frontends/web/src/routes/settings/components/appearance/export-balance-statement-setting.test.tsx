// SPDX-License-Identifier: Apache-2.0

import i18n from '../../../../../__mocks__/i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAccount } from '@/api/account';
import { exportBalanceStatement, type TExportBalanceStatementResponse } from '@/api/backend';
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
  code: 'v0-55555555-btc-0',
  coinCode: 'btc',
  coinName: 'Bitcoin',
  coinUnit: 'BTC',
  name: 'Bitcoin account',
  isToken: false,
  blockExplorerTxPrefix: 'https://mempool.space/tx/',
  keystore: {
    connected: true,
    lastConnected: '',
    name: 'BitBox02',
    rootFingerprint: '55555555',
    watchonly: false,
  },
};

const generateStatement = async (selectedAccount: TAccount = account) => {
  const user = userEvent.setup();
  render(
    <BackButtonContext.Provider value={{ pushHandler: vi.fn(), popHandler: vi.fn() }}>
      <ExportBalanceStatementSetting accounts={[selectedAccount]} />
    </BackButtonContext.Provider>
  );

  await user.click(screen.getByRole('button', { name: /Export statement of balance/ }));
  await user.click(screen.getByRole('button', { name: 'Generate PDF' }));
};

describe('ExportBalanceStatementSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Unsupported Sepolia exports must show the translated explanation instead of
  // a provider error, keeping the selection dialog open so other accounts can be chosen.
  it('explains why Sepolia exports are unavailable', async () => {
    vi.mocked(exportBalanceStatement).mockResolvedValue({
      success: false,
      aborted: false,
      errorCode: 'sepoliaBalanceStatementUnsupported',
      message: 'Error! Missing Or invalid Action name',
    });
    await generateStatement({
      ...account,
      code: 'v0-55555555-sepeth-0',
      coinCode: 'sepeth',
      coinName: 'Ethereum Sepolia',
      coinUnit: 'SEPETH',
      name: 'Sepolia account',
      blockExplorerTxPrefix: 'https://sepolia.etherscan.io/tx/',
    });

    await waitFor(() => {
      expect(alertUser).toHaveBeenCalledWith(
        en.settings.balanceStatement.export.errors.sepoliaBalanceStatementUnsupported
      );
    });
    expect(screen.getByRole('heading', { name: 'Export statement of balance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate PDF' })).toBeEnabled();
  });

  // A snapshot requested during the initial BTC/LTC sync must explain that the
  // user can retry once syncing finishes, rather than silently ignoring its error code.
  it('explains an account sync failure', async () => {
    vi.mocked(exportBalanceStatement).mockResolvedValue({
      success: false,
      aborted: false,
      errorCode: 'syncInProgress',
      message: `failed to determine the balance of account ${account.code} at the snapshot date: syncInProgress`,
    });

    await generateStatement();

    await waitFor(() => {
      expect(alertUser).toHaveBeenCalledWith(en.send.error.syncInProgress);
    });
    expect(screen.getByRole('heading', { name: 'Export statement of balance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate PDF' })).toBeEnabled();
  });

  // Every non-abort failure must show feedback, including future backend error
  // codes and responses that have no explanation to display.
  it.each<{
    name: string;
    response: TExportBalanceStatementResponse;
    expectedMessage: string;
  }>([
    {
      name: 'an unrecognized error code',
      response: { success: false, aborted: false, errorCode: 'unexpectedFailure' },
      expectedMessage: en.genericError,
    },
    {
      name: 'a backend message',
      response: { success: false, aborted: false, errorCode: 'unexpectedFailure', message: 'Could not write the PDF' },
      expectedMessage: 'Could not write the PDF',
    },
    {
      name: 'an empty failure response',
      response: { success: false, aborted: false },
      expectedMessage: en.genericError,
    },
  ])('shows feedback for $name', async ({ response, expectedMessage }) => {
    vi.mocked(exportBalanceStatement).mockResolvedValue(response);

    await generateStatement();

    await waitFor(() => {
      expect(alertUser).toHaveBeenCalledWith(expectedMessage);
    });
    expect(screen.getByRole('button', { name: 'Generate PDF' })).toBeEnabled();
  });

  // Cancelling the native save dialog is an intentional user action and must
  // leave the export dialog usable without displaying a failure alert.
  it('does not show an error for cancellation', async () => {
    vi.mocked(exportBalanceStatement).mockResolvedValue({ success: false, aborted: true });

    await generateStatement();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generate PDF' })).toBeEnabled();
    });
    expect(alertUser).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Export statement of balance' })).toBeInTheDocument();
  });
});
