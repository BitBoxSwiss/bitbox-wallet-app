// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { useState } from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@/i18n/i18n');
vi.mock('@/components/qrcode/qrcode', () => ({
  QRCode: () => null,
}));

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as accountApi from '@/api/account';
import * as keystoresApi from '@/api/keystores';
import * as backendApi from '@/api/backend';
import { Addresses } from './addresses';

const mockAccount: accountApi.TAccount = {
  keystore: {
    watchonly: false,
    rootFingerprint: 'f23ab988',
    name: 'BitBox02',
    lastConnected: '',
    connected: true,
  },
  active: true,
  coinCode: 'btc',
  coinUnit: 'BTC',
  coinName: 'Bitcoin',
  code: 'btc-account',
  name: 'Bitcoin Account',
  isToken: false,
  blockExplorerTxPrefix: 'https://example.com/tx/',
};

const receiveAddress: accountApi.TUsedAddress = {
  address: 'bc1qreceiveusedaddress',
  addressID: 'receive-address-id',
  scriptType: 'p2wpkh',
  addressType: 'receive',
  lastUsed: '2025-01-12T10:00:00Z',
  totalReceived: {
    amount: '0.01000000',
    unit: 'BTC',
    estimated: false,
  },
  transactionCount: 2,
};

const changeAddress: accountApi.TUsedAddress = {
  address: 'bc1qchangeusedaddress',
  addressID: 'change-address-id',
  scriptType: 'p2wpkh-p2sh',
  addressType: 'change',
  lastUsed: null,
  totalReceived: {
    amount: '0.00420000',
    unit: 'BTC',
    estimated: false,
  },
  transactionCount: 1,
};

const ltcAccount: accountApi.TAccount = {
  ...mockAccount,
  coinCode: 'ltc',
  coinUnit: 'LTC',
  coinName: 'Litecoin',
  name: 'Litecoin Account',
};

const createDeferred = function<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const renderWithRoute = (initialEntry: string, initialAccounts: accountApi.TAccount[] = [mockAccount]) => {
  let setAccountsState: ((accounts: accountApi.TAccount[]) => void) | undefined;

  const RouteWrapper = () => {
    const [accounts, setAccounts] = useState(initialAccounts);
    setAccountsState = setAccounts;
    return (
      <Routes>
        <Route path="/account/:code/addresses" element={<Addresses code={mockAccount.code} accounts={accounts} />} />
        <Route path="/account/:code/addresses/:addressID" element={<Addresses code={mockAccount.code} accounts={accounts} />} />
        <Route path="/account/:code/addresses/:addressID/verify" element={<Addresses code={mockAccount.code} accounts={accounts} />} />
      </Routes>
    );
  };

  return {
    ...render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <RouteWrapper />
      </MemoryRouter>
    ),
    setAccounts: (accounts: accountApi.TAccount[]) => {
      setAccountsState?.(accounts);
    },
  };
};

describe('routes/account/addresses', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    vi.spyOn(accountApi, 'getUsedAddresses').mockResolvedValue({
      success: true,
      addresses: [receiveAddress, changeAddress],
    });
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    vi.spyOn(backendApi, 'cancelConnectKeystore').mockResolvedValue();
  });

  it('supports receive/change filtering, search and inline address actions', async () => {
    const user = userEvent.setup();

    renderWithRoute('/account/btc-account/addresses');

    await screen.findByTitle(receiveAddress.address);
    expect(screen.queryByText(changeAddress.address)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change addresses' }));
    await screen.findByTitle(changeAddress.address);

    await user.type(screen.getByPlaceholderText('Search address'), 'does-not-match-anything');
    await screen.findByText('No addresses match your filters.');

    const searchInput = screen.getByPlaceholderText('Search address') as HTMLInputElement;
    await user.clear(searchInput);
    await user.click(screen.getByTitle(changeAddress.address));

    expect(screen.getByPlaceholderText('Search address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Address' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign message' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify address on device' })).not.toBeInTheDocument();
  });

  it('hides message-signing action for LTC accounts', async () => {
    const user = userEvent.setup();

    renderWithRoute('/account/btc-account/addresses', [ltcAccount]);

    await user.click(await screen.findByTitle(receiveAddress.address));
    expect(screen.getByRole('button', { name: 'Copy Address' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign message' })).not.toBeInTheDocument();
  });

  it('shows insecure verify warning and skip path without calling verify API', async () => {
    const verifyAddressSpy = vi.spyOn(accountApi, 'verifyAddress').mockResolvedValue(true);
    vi.spyOn(accountApi, 'hasSecureOutput').mockReturnValue(async () => ({
      hasSecureOutput: false,
      optional: false,
    }));

    const user = userEvent.setup();

    renderWithRoute(`/account/${mockAccount.code}/addresses/${receiveAddress.addressID}/verify`);

    await screen.findByText('Skip device verification?');
    await user.click(screen.getByRole('button', { name: 'Yes, skip verification' }));
    await screen.findByText('Address');
    expect(screen.queryByText('Please verify that the following address matches the one displayed on your device.')).not.toBeInTheDocument();
    expect(verifyAddressSpy).not.toHaveBeenCalled();
  });

  it('shows verify connection error with retry action when device connection fails', async () => {
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: false });

    const user = userEvent.setup();
    renderWithRoute(`/account/${mockAccount.code}/addresses/${receiveAddress.addressID}/verify`);

    await screen.findByText('Could not connect to the selected device.');
    await user.click(screen.getByRole('button', { name: /Retry|generic\.retry/ }));

    await waitFor(() => {
      expect(keystoresApi.connectKeystore).toHaveBeenCalledTimes(2);
    });
  });

  it('shows verify connection error when device connection request rejects', async () => {
    const connectSpy = vi.spyOn(keystoresApi, 'connectKeystore')
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockResolvedValueOnce({ success: false });
    const user = userEvent.setup();

    renderWithRoute(`/account/${mockAccount.code}/addresses/${receiveAddress.addressID}/verify`);

    await screen.findByText('Could not connect to the selected device.');
    await user.click(screen.getByRole('button', { name: /Retry|generic\.retry/ }));

    await waitFor(() => {
      expect(connectSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('does not render a local connecting overlay while waiting for keystore prompt', async () => {
    vi.spyOn(keystoresApi, 'connectKeystore').mockReturnValue(new Promise(() => {}));

    renderWithRoute(`/account/${mockAccount.code}/addresses/${receiveAddress.addressID}/verify`);

    await screen.findByPlaceholderText('Search address');
    expect(screen.queryByText(/Connecting to device/i)).not.toBeInTheDocument();
  });

  it('opens verify flow when clicking copy address action from the list', async () => {
    const connectSpy = vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    vi.spyOn(accountApi, 'hasSecureOutput').mockReturnValue(async () => ({
      hasSecureOutput: false,
      optional: false,
    }));
    const user = userEvent.setup();

    renderWithRoute(`/account/${mockAccount.code}/addresses`);

    await user.click(await screen.findByTitle(receiveAddress.address));
    await user.click(screen.getByRole('button', { name: 'Copy Address' }));

    await waitFor(() => {
      expect(connectSpy).toHaveBeenCalledWith(mockAccount.keystore.rootFingerprint);
    });
  });

  it('verifies securely when secure output exists', async () => {
    const verifyAddressSpy = vi.spyOn(accountApi, 'verifyAddress').mockResolvedValue(true);
    vi.spyOn(accountApi, 'hasSecureOutput').mockReturnValue(async () => ({
      hasSecureOutput: true,
      optional: false,
    }));

    renderWithRoute(`/account/${mockAccount.code}/addresses/${receiveAddress.addressID}/verify`);

    await waitFor(() => {
      expect(verifyAddressSpy).toHaveBeenCalledWith(mockAccount.code, receiveAddress.addressID);
    });
    await screen.findByRole('button', { name: 'Copy Address' });
    await screen.findByRole('button', { name: 'Sign message' });
  });

  it('shows receive-style verify dialog while secure verification is in progress', async () => {
    const verifyAddressSpy = vi.spyOn(accountApi, 'verifyAddress').mockImplementation(() => new Promise(() => {}));
    vi.spyOn(accountApi, 'hasSecureOutput').mockReturnValue(async () => ({
      hasSecureOutput: true,
      optional: false,
    }));

    renderWithRoute(`/account/${mockAccount.code}/addresses/${receiveAddress.addressID}/verify`);

    await waitFor(() => {
      expect(verifyAddressSpy).toHaveBeenCalledWith(mockAccount.code, receiveAddress.addressID);
    });
    await screen.findByText('Verify address on BitBox');
    await screen.findByText('Please verify that the following address matches the one displayed on your device.');
  });

  it('closes the verify dialog after confirmation when the account updates during verification', async () => {
    const verifyAddressDeferred = createDeferred<boolean>();
    const verifyAddressSpy = vi.spyOn(accountApi, 'verifyAddress').mockReturnValue(verifyAddressDeferred.promise);
    vi.spyOn(accountApi, 'hasSecureOutput').mockReturnValue(async () => ({
      hasSecureOutput: true,
      optional: false,
    }));

    const disconnectedAccount: accountApi.TAccount = {
      ...mockAccount,
      keystore: {
        ...mockAccount.keystore,
        connected: false,
      },
    };
    const { setAccounts } = renderWithRoute(
      `/account/${mockAccount.code}/addresses/${receiveAddress.addressID}/verify`,
      [disconnectedAccount],
    );

    await waitFor(() => {
      expect(verifyAddressSpy).toHaveBeenCalledWith(mockAccount.code, receiveAddress.addressID);
    });
    await screen.findByText('Please verify that the following address matches the one displayed on your device.');

    act(() => {
      setAccounts([{
        ...disconnectedAccount,
        keystore: {
          ...disconnectedAccount.keystore,
          connected: true,
        },
      }]);
      verifyAddressDeferred.resolve(true);
    });

    await waitFor(() => {
      expect(screen.queryByText('Please verify that the following address matches the one displayed on your device.')).not.toBeInTheDocument();
    });
  });

  it('shows skip warning then verify dialog when skip is requested in verify route', async () => {
    const user = userEvent.setup();

    renderWithRoute(`/account/${mockAccount.code}/addresses/${receiveAddress.addressID}/verify?skipDeviceVerification=1`);

    await screen.findByText('Skip device verification?');
    await user.click(screen.getByRole('button', { name: 'Yes, skip verification' }));

    await screen.findByText('Address');
    expect(screen.queryByText('Please verify that the following address matches the one displayed on your device.')).not.toBeInTheDocument();
  });

  it('aborts verify flow when cancel is clicked on skip warning dialog', async () => {
    const user = userEvent.setup();

    renderWithRoute(`/account/${mockAccount.code}/addresses/${receiveAddress.addressID}/verify?skipDeviceVerification=1`);

    await screen.findByText('Skip device verification?');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await screen.findByPlaceholderText('Search address');
    expect(screen.queryByText('Skip device verification?')).not.toBeInTheDocument();
  });

});
