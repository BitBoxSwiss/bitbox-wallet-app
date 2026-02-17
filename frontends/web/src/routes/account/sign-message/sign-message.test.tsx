// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@/i18n/i18n');

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as accountApi from '@/api/account';
import * as keystoresApi from '@/api/keystores';
import { SignMessage } from './sign-message';

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

const ltcAccount: accountApi.TAccount = {
  ...mockAccount,
  coinCode: 'ltc',
  coinUnit: 'LTC',
  coinName: 'Litecoin',
  name: 'Litecoin Account',
};

const usedAddress: accountApi.TUsedAddress = {
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

describe('routes/account/sign-message', () => {
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
  });

  it('keeps script type selection available on the standalone sign-message page', async () => {
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    const receiveAddresses: [accountApi.TReceiveAddressList, ...accountApi.TReceiveAddressList[]] = [
      {
        scriptType: 'p2wpkh',
        addresses: [{ address: 'bc1qnativeexample', addressID: 'native-address-id' }],
      },
      {
        scriptType: 'p2wpkh-p2sh',
        addresses: [{ address: '3wrappedexample', addressID: 'wrapped-address-id' }],
      },
    ];
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => receiveAddresses);
    const signMessageSpy = vi.spyOn(accountApi, 'signMessage').mockResolvedValue({
      success: true,
      address: '3wrappedexample',
      signature: 'signed-message',
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignMessage
          accounts={[mockAccount]}
          code={mockAccount.code}
        />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: 'Change address type' }));
    const wrappedScriptTypeInput = document.getElementById('p2wpkh-p2sh');
    expect(wrappedScriptTypeInput).not.toBeNull();
    await user.click(wrappedScriptTypeInput as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await user.type(
      await screen.findByPlaceholderText('Enter the message to sign'),
      'message from standalone sign page',
    );
    expect(screen.getByRole('button', { name: 'Sign on device' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign on device' }));

    await waitFor(() => {
      expect(signMessageSpy).toHaveBeenCalledWith(
        mockAccount.code,
        'wrapped-address-id',
        'message from standalone sign page',
      );
    });

    await screen.findByText('Message signed successfully.');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('returns to account info when device connection is canceled', async () => {
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({
      success: false,
      errorCode: 'userAbort',
    });
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => [
      {
        scriptType: 'p2wpkh',
        addresses: [{ address: 'bc1qnativeexample', addressID: 'native-address-id' }],
      },
    ]);

    render(
      <MemoryRouter initialEntries={[`/account/${mockAccount.code}/sign-message`]}>
        <Routes>
          <Route
            path="/account/:code/sign-message"
            element={
              <SignMessage
                accounts={[mockAccount]}
                code={mockAccount.code}
              />
            }
          />
          <Route path="/account/:code/info" element={<div>account-info-page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('account-info-page');
  });

  it('does not reconnect keystore when changing receive address', async () => {
    const connectSpy = vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => [
      {
        scriptType: 'p2wpkh',
        addresses: [
          { address: 'bc1qnativeexample0', addressID: 'native-address-id-0' },
          { address: 'bc1qnativeexample1', addressID: 'native-address-id-1' },
        ],
      },
    ]);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignMessage
          accounts={[mockAccount]}
          code={mockAccount.code}
        />
      </MemoryRouter>
    );

    await screen.findByPlaceholderText('Enter the message to sign');
    expect(connectSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Address (2/2)')).toBeInTheDocument();
    });
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('shows retry state when device connection request rejects', async () => {
    const connectSpy = vi.spyOn(keystoresApi, 'connectKeystore')
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockResolvedValueOnce({ success: true });
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => [
      {
        scriptType: 'p2wpkh',
        addresses: [{ address: 'bc1qnativeexample', addressID: 'native-address-id' }],
      },
    ]);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignMessage
          accounts={[mockAccount]}
          code={mockAccount.code}
        />
      </MemoryRouter>
    );

    await screen.findByText('Could not connect to the selected device.');
    await user.click(screen.getByRole('button', { name: /Retry|generic\.retry/ }));

    await waitFor(() => {
      expect(connectSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('returns to input state when signing is aborted on device', async () => {
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => [
      {
        scriptType: 'p2wpkh',
        addresses: [{ address: 'bc1qnativeexample', addressID: 'native-address-id' }],
      },
    ]);
    const signMessageSpy = vi.spyOn(accountApi, 'signMessage').mockResolvedValue({
      success: false,
      errorCode: 'userAbort',
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignMessage
          accounts={[mockAccount]}
          code={mockAccount.code}
        />
      </MemoryRouter>
    );

    await user.type(
      await screen.findByPlaceholderText('Enter the message to sign'),
      'abort test',
    );
    await user.click(screen.getByRole('button', { name: 'Sign on device' }));

    await waitFor(() => {
      expect(signMessageSpy).toHaveBeenCalledWith(
        mockAccount.code,
        'native-address-id',
        'abort test',
      );
    });

    expect(screen.getByRole('button', { name: 'Sign on device' })).toBeInTheDocument();
    expect(screen.queryByText('Message signed successfully.')).not.toBeInTheDocument();
  });

  it('shows unsupported state for LTC accounts', async () => {
    const connectSpy = vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    const signMessageSpy = vi.spyOn(accountApi, 'signMessage');
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => [
      {
        scriptType: 'p2wpkh',
        addresses: [{ address: 'ltc1qexampleaddress', addressID: 'ltc-address-id' }],
      },
    ]);

    render(
      <MemoryRouter>
        <SignMessage
          accounts={[ltcAccount]}
          code={ltcAccount.code}
        />
      </MemoryRouter>
    );

    await screen.findByText('Message signing is not supported for Litecoin yet.');
    expect(screen.queryByRole('button', { name: 'Sign on device' })).not.toBeInTheDocument();
    expect(connectSpy).not.toHaveBeenCalled();
    expect(signMessageSpy).not.toHaveBeenCalled();
  });

  it('signs from used-address route with fixed selected addressID and no script-type chooser', async () => {
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    vi.spyOn(accountApi, 'getUsedAddresses').mockResolvedValue({
      success: true,
      addresses: [usedAddress],
    });
    const signMessageSpy = vi.spyOn(accountApi, 'signMessage').mockResolvedValue({
      success: true,
      address: usedAddress.address,
      signature: 'signed-message',
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/account/${mockAccount.code}/addresses/${usedAddress.addressID}/sign-message`]}>
        <Routes>
          <Route
            path="/account/:code/addresses/:addressID/sign-message"
            element={(
              <SignMessage
                accounts={[mockAccount]}
                code={mockAccount.code}
              />
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Change address type')).not.toBeInTheDocument();

    await user.type(
      await screen.findByPlaceholderText('Enter the message to sign'),
      'message from used-address route',
    );
    await user.click(screen.getByRole('button', { name: 'Sign on device' }));

    await waitFor(() => {
      expect(signMessageSpy).toHaveBeenCalledWith(
        mockAccount.code,
        usedAddress.addressID,
        'message from used-address route',
      );
    });
  });

  it('returns to addresses list when used-address sign-message connection is canceled', async () => {
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({
      success: false,
      errorCode: 'userAbort',
    });
    vi.spyOn(accountApi, 'getUsedAddresses').mockResolvedValue({
      success: true,
      addresses: [usedAddress],
    });

    render(
      <MemoryRouter initialEntries={[`/account/${mockAccount.code}/addresses/${usedAddress.addressID}/sign-message`]}>
        <Routes>
          <Route
            path="/account/:code/addresses/:addressID/sign-message"
            element={(
              <SignMessage
                accounts={[mockAccount]}
                code={mockAccount.code}
              />
            )}
          />
          <Route path="/account/:code/addresses" element={<div>addresses-list-page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('addresses-list-page');
  });

  it('shows address-not-found state for invalid used-address sign-message route', async () => {
    const connectSpy = vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    vi.spyOn(accountApi, 'getUsedAddresses').mockResolvedValue({
      success: true,
      addresses: [usedAddress],
    });

    render(
      <MemoryRouter initialEntries={[`/account/${mockAccount.code}/addresses/invalid-address-id/sign-message`]}>
        <Routes>
          <Route
            path="/account/:code/addresses/:addressID/sign-message"
            element={(
              <SignMessage
                accounts={[mockAccount]}
                code={mockAccount.code}
              />
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Address not found.');
    expect(screen.queryByText('Could not connect to the selected device.')).not.toBeInTheDocument();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('shows unsupported state for direct LTC used-address sign-message route', async () => {
    const connectSpy = vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    vi.spyOn(accountApi, 'getUsedAddresses').mockResolvedValue({
      success: true,
      addresses: [{
        ...usedAddress,
        address: 'ltc1qexampleaddress',
        addressID: 'ltc-address-id',
      }],
    });

    render(
      <MemoryRouter initialEntries={[`/account/${ltcAccount.code}/addresses/ltc-address-id/sign-message`]}>
        <Routes>
          <Route
            path="/account/:code/addresses/:addressID/sign-message"
            element={(
              <SignMessage
                accounts={[ltcAccount]}
                code={ltcAccount.code}
              />
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Message signing is not supported for Litecoin yet.');
    expect(screen.queryByPlaceholderText('Enter the message to sign')).not.toBeInTheDocument();
    expect(connectSpy).not.toHaveBeenCalled();
  });
});
