// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as accountApi from '@/api/account';
import { connectKeystore } from '@/api/keystores';
import { alertUser } from '@/components/alert/Alert';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { Receive } from './receive';

vi.mock('@/api/account');
vi.mock('@/api/keystores');
vi.mock('@/components/alert/Alert', () => ({ alertUser: vi.fn() }));
vi.mock('@/components/qrcode/qrcode', () => ({ QRCode: () => null }));
vi.mock('./components/guide', () => ({ ReceiveGuide: () => null }));
vi.mock('@/components/dialog/firmware-upgrade-required-dialog', () => ({
  FirmwareUpgradeRequiredDialog: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>firmware upgrade required</button>
  ),
}));

const account: accountApi.TAccount = {
  active: true,
  blockExplorerTxPrefix: '',
  code: 'btc-account',
  coinCode: 'btc',
  coinName: 'Bitcoin',
  coinUnit: 'BTC',
  isToken: false,
  keystore: {
    connected: true,
    lastConnected: '',
    name: 'BitBox02',
    rootFingerprint: 'f23ab988',
    watchonly: false,
  },
  name: 'Bitcoin Account',
  receiveScriptType: 'p2tr',
};

const renderReceive = () => render(
  <MemoryRouter>
    <BackButtonProvider>
      <Receive accounts={[account]} code={account.code} />
    </BackButtonProvider>
  </MemoryRouter>
);

describe('receive address verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(connectKeystore).mockResolvedValue({ success: true });
    vi.mocked(accountApi.hasSecureOutput).mockReturnValue(async () => ({
      success: true,
      hasSecureOutput: true,
      optional: false,
    }));
    vi.mocked(accountApi.getReceiveAddressList).mockReturnValue(async () => ({
      success: true,
      addresses: [
        {
          scriptType: 'p2wpkh',
          addresses: [{ addressID: 'segwit-address', address: 'bc1qtest', displayAddress: 'bc1qtest' }],
        },
        {
          scriptType: 'p2tr',
          addresses: [{ addressID: 'taproot-address', address: 'bc1ptest', displayAddress: 'bc1ptest' }],
        },
      ],
    }));
  });

  it('prompts for an upgrade and allows retrying', async () => {
    const verify = vi.mocked(accountApi.verifyAddress);
    verify.mockResolvedValueOnce({ success: false, errorCode: 'firmwareUpgradeRequired' });
    verify.mockResolvedValue({ success: true });
    renderReceive();

    await screen.findByDisplayValue('bc1ptest...');
    fireEvent.click(screen.getByRole('button', { name: 'receive.verifyBitBox02' }));

    const upgradePrompt = await screen.findByRole('button', { name: 'firmware upgrade required' });
    expect(connectKeystore).toHaveBeenCalledWith(account.keystore.rootFingerprint);
    expect(verify).toHaveBeenCalledWith(account.code, 'taproot-address');
    expect(alertUser).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('receive.verifyInstruction')).not.toBeInTheDocument());

    fireEvent.click(upgradePrompt);
    fireEvent.click(screen.getByRole('button', { name: 'receive.verifyBitBox02' }));

    await waitFor(() => expect(verify).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('firmware upgrade required')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'receive.verifyBitBox02' })).toBeEnabled();
  });

  it('shows other verification errors without prompting for an upgrade', async () => {
    vi.mocked(accountApi.verifyAddress).mockResolvedValue({ success: false, errorMessage: 'verification failed' });
    renderReceive();

    await screen.findByDisplayValue('bc1ptest...');
    fireEvent.click(screen.getByRole('button', { name: 'receive.verifyBitBox02' }));

    await waitFor(() => expect(alertUser).toHaveBeenCalledWith('verification failed'));
    expect(screen.queryByText('firmware upgrade required')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'receive.verifyBitBox02' })).toBeEnabled();
  });

  it('does not reveal an address when checking secure output fails', async () => {
    vi.mocked(accountApi.hasSecureOutput).mockReturnValue(async () => ({
      success: false, errorMessage: 'device unavailable',
    }));
    renderReceive();

    await screen.findByDisplayValue('bc1ptest...');
    fireEvent.click(screen.getByRole('button', { name: 'receive.verifyBitBox02' }));

    await waitFor(() => expect(alertUser).toHaveBeenCalledWith('device unavailable'));
    expect(accountApi.verifyAddress).not.toHaveBeenCalled();
    expect(screen.queryByTestId('receive-address')).not.toBeInTheDocument();
  });

  it('shows a receive-address loading failure', async () => {
    vi.mocked(accountApi.getReceiveAddressList).mockReturnValue(async () => ({
      success: false, errorMessage: 'addresses unavailable',
    }));
    renderReceive();

    expect(await screen.findByText('addresses unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'receive.verifyBitBox02' })).not.toBeInTheDocument();
  });
});
