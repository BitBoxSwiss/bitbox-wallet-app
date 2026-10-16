// SPDX-License-Identifier: Apache-2.0

import '../../../../../../__mocks__/i18n';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getReceiveAddressList, getStatus, TAccount } from '@/api/account';
import { ReceiverAddressInputField } from './receiver-address-input-field';

vi.mock('@/i18n/i18n');
vi.mock('@/api/account', () => ({
  getReceiveAddressList: vi.fn(),
  getStatus: vi.fn(),
}));
vi.mock('@/api/accountsync', () => ({
  statusChanged: vi.fn(() => vi.fn()),
  syncdone: vi.fn(() => vi.fn()),
}));
vi.mock('@/components/dialog/firmware-upgrade-required-dialog', () => ({
  FirmwareUpgradeRequiredDialog: () => null,
}));

const account: TAccount = {
  code: 'btc-account',
  name: 'Bitcoin account',
  coinCode: 'btc',
  coinUnit: 'BTC',
  coinName: 'Bitcoin',
  active: true,
  isToken: false,
  blockExplorerTxPrefix: '',
  keystore: {
    rootFingerprint: 'fingerprint',
    name: 'BitBox02',
    connected: true,
    watchonly: false,
    lastConnected: '',
  },
};
const accounts = [account];
const receiveAddresses: Awaited<ReturnType<ReturnType<typeof getReceiveAddressList>>> = [{
  scriptType: 'p2wpkh',
  addresses: [{ address: 'account-address', addressID: '0', displayAddress: 'account-address' }],
}];
const readClipboard = vi.fn<() => Promise<string>>();
const onAccountChange = vi.fn();
const onScanQR = vi.fn();

const TestInput = () => {
  const [address, setAddress] = useState('');
  return (
    <ReceiverAddressInputField
      accounts={accounts}
      inputLabel="Recipient address"
      inputPlaceholder="Address"
      onAccountChange={onAccountChange}
      onInputChange={setAddress}
      onScanQR={onScanQR}
      recipientAddress={address}
      requireSendToSelfSupport={false}
    />
  );
};

const selectAccount = async () => {
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
  await waitFor(() => expect(screen.getByRole('option', { name: /Bitcoin account/ })).toHaveAttribute('aria-disabled', 'false'));
  fireEvent.click(screen.getByRole('option', { name: /Bitcoin account/ }));
  await screen.findByRole('button', { name: 'generic.reset' });
};

const expectReset = () => {
  expect(screen.getByText('send.sendToAccount.placeholder')).toBeInTheDocument();
  expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly');
  expect(screen.queryByRole('button', { name: 'generic.reset' })).not.toBeInTheDocument();
  expect(onAccountChange).toHaveBeenLastCalledWith(null);
};

const getActionButton = (action: 'scan' | 'paste') => {
  const button = screen.getAllByRole('button', { name: '' })[action === 'scan' ? 0 : 1];
  if (!button) {
    throw new Error(`Missing ${action} button`);
  }
  return button;
};

describe('ReceiverAddressInputField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: readClipboard },
    });
    readClipboard.mockResolvedValue('  pasted-address  ');
    vi.mocked(getStatus).mockResolvedValue({
      disabled: false, synced: true, fatalError: false, offlineError: null,
    });
    vi.mocked(getReceiveAddressList).mockReturnValue(() => Promise.resolve(receiveAddresses));
  });

  it('resets the selected account and makes the pasted address editable', async () => {
    render(<TestInput />);
    await selectAccount();
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('account-address'));
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(onAccountChange).toHaveBeenLastCalledWith(account);

    fireEvent.click(getActionButton('paste'));

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('pasted-address'));
    expectReset();
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'edited-address' } });
    expect(screen.getByRole('textbox')).toHaveValue('edited-address');
  });

  it('resets the selected account and address before opening the scanner', async () => {
    render(<TestInput />);
    await selectAccount();
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('account-address'));

    fireEvent.click(getActionButton('scan'));

    expect(onScanQR).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expectReset();
  });

  it.each(['empty', 'failed'])('keeps the account selected when paste is %s', async (result) => {
    render(<TestInput />);
    await selectAccount();
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('account-address'));
    if (result === 'empty') {
      readClipboard.mockResolvedValueOnce('   ');
    } else {
      readClipboard.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    }

    await act(async () => fireEvent.click(getActionButton('paste')));

    expect(readClipboard).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox')).toHaveValue('account-address');
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'generic.reset' })).toBeInTheDocument();
    expect(onAccountChange).toHaveBeenLastCalledWith(account);
  });

  it.each(['scan', 'paste', 'reset'] as const)('ignores a pending account address after %s', async (action) => {
    let resolveAddresses: (value: typeof receiveAddresses) => void = () => {};
    vi.mocked(getReceiveAddressList).mockReturnValue(() => new Promise(resolve => {
      resolveAddresses = resolve;
    }));
    render(<TestInput />);
    await selectAccount();

    if (action === 'reset') {
      fireEvent.click(screen.getByRole('button', { name: 'generic.reset' }));
    } else {
      await act(async () => fireEvent.click(getActionButton(action)));
    }
    await act(async () => resolveAddresses(receiveAddresses));

    expect(screen.getByRole('textbox')).toHaveValue(action === 'paste' ? 'pasted-address' : '');
    expectReset();
  });
});
