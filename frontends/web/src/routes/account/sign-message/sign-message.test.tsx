// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('@/i18n/i18n');
// initialize i18n once at startup
import '@/i18n/i18n';

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

const ethAccount: accountApi.TAccount = {
  ...mockAccount,
  coinCode: 'eth',
  coinUnit: 'ETH',
  coinName: 'Ethereum',
  code: 'eth-account',
  name: 'Ethereum Account',
};

const groupAddress = (value: string): string => {
  if (value.startsWith('0x') || value.startsWith('0X')) {
    return `${value.slice(0, 2)} ${value.slice(2).replace(/(.{4})/g, '$1 ').trim()}`;
  }
  return value.replace(/(.{4})/g, '$1 ').trim();
};

const usedAddress: accountApi.TUsedAddress = {
  address: 'bc1qreceiveusedaddress',
  displayAddress: groupAddress('bc1qreceiveusedaddress'),
  addressID: 'receive-address-id',
  addressType: 'receive',
  canSignMsg: true,
  lastUsed: '2025-01-12T10:00:00Z',
};

describe('routes/account/sign-message', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
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

  it('uses native segwit addresses on the standalone sign-message page', async () => {
    const receiveAddresses: [accountApi.TReceiveAddressList, ...accountApi.TReceiveAddressList[]] = [
      {
        scriptType: 'p2wpkh',
        addresses: [{
          address: 'bc1qnativeexample',
          displayAddress: groupAddress('bc1qnativeexample'),
          addressID: 'native-address-id',
        }],
      },
      {
        scriptType: 'p2wpkh-p2sh',
        addresses: [{
          address: '3wrappedexample',
          displayAddress: groupAddress('3wrappedexample'),
          addressID: 'wrapped-address-id',
        }],
      },
    ];
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => receiveAddresses);
    const signMessageSpy = vi.spyOn(accountApi, 'signBTCMessageForAddress').mockResolvedValue({
      success: true,
      address: 'bc1qnativeexample',
      displayAddress: groupAddress('bc1qnativeexample'),
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

    await screen.findByDisplayValue(groupAddress('bc1qnativeexample'));
    expect(screen.queryByRole('button', { name: 'Change address type' })).not.toBeInTheDocument();

    await user.type(
      await screen.findByPlaceholderText('Enter the message to sign'),
      'message from standalone sign page',
    );
    expect(screen.getByRole('button', { name: 'Sign on device' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign on device' }));

    await waitFor(() => {
      expect(keystoresApi.connectKeystore).toHaveBeenCalledWith(mockAccount.keystore.rootFingerprint);
      expect(signMessageSpy).toHaveBeenCalledWith(
        mockAccount.code,
        'native-address-id',
        'message from standalone sign page',
      );
    });

    await screen.findByText('Message signed');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('does not pre-connect keystore when rendering or changing receive address', async () => {
    const connectSpy = vi.spyOn(keystoresApi, 'connectKeystore');
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => [
      {
        scriptType: 'p2wpkh',
        addresses: [
          {
            address: 'bc1qnativeexample0',
            displayAddress: groupAddress('bc1qnativeexample0'),
            addressID: 'native-address-id-0',
          },
          {
            address: 'bc1qnativeexample1',
            displayAddress: groupAddress('bc1qnativeexample1'),
            addressID: 'native-address-id-1',
          },
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
    expect(connectSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Address')).toBeInTheDocument();
      expect(screen.getByText('2/2')).toBeInTheDocument();
    });
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('returns to input state when signing is aborted on device', async () => {
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => [
      {
        scriptType: 'p2wpkh',
        addresses: [{
          address: 'bc1qnativeexample',
          displayAddress: groupAddress('bc1qnativeexample'),
          addressID: 'native-address-id',
        }],
      },
    ]);
    const signMessageSpy = vi.spyOn(accountApi, 'signBTCMessageForAddress').mockResolvedValue({
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
      expect(keystoresApi.connectKeystore).toHaveBeenCalledWith(mockAccount.keystore.rootFingerprint);
      expect(signMessageSpy).toHaveBeenCalledWith(
        mockAccount.code,
        'native-address-id',
        'abort test',
      );
    });

    expect(screen.getByRole('button', { name: 'Sign on device' })).toBeInTheDocument();
    expect(screen.queryByText('Message signed')).not.toBeInTheDocument();
  });

  it('signs from used-address route with pre-selected addressID and no script-type chooser', async () => {
    vi.spyOn(accountApi, 'getUsedAddresses').mockResolvedValue({
      success: true,
      addresses: [usedAddress],
    });
    const signMessageSpy = vi.spyOn(accountApi, 'signBTCMessageForAddress').mockResolvedValue({
      success: true,
      address: usedAddress.address,
      displayAddress: usedAddress.displayAddress,
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
      expect(keystoresApi.connectKeystore).toHaveBeenCalledWith(mockAccount.keystore.rootFingerprint);
      expect(signMessageSpy).toHaveBeenCalledWith(
        mockAccount.code,
        usedAddress.addressID,
        'message from used-address route',
      );
    });
  });

  it('shows address-not-found state for invalid used-address sign-message route', async () => {
    const connectSpy = vi.spyOn(keystoresApi, 'connectKeystore');
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

  it('signs an ETH message using signETHMessageForAddress', async () => {
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => [
      {
        scriptType: null,
        addresses: [{
          address: '0xAbC123def456',
          displayAddress: groupAddress('0xAbC123def456'),
          addressID: 'eth-address-id',
        }],
      },
    ]);
    const btcSignSpy = vi.spyOn(accountApi, 'signBTCMessageForAddress');
    const ethSignSpy = vi.spyOn(accountApi, 'signETHMessageForAddress').mockResolvedValue({
      success: true,
      address: '0xAbC123def456',
      displayAddress: groupAddress('0xAbC123def456'),
      signature: '0xethsignature',
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignMessage
          accounts={[ethAccount]}
          code={ethAccount.code}
        />
      </MemoryRouter>
    );

    await user.type(
      await screen.findByPlaceholderText('Enter the message to sign'),
      'eth sign test',
    );
    await user.click(screen.getByRole('button', { name: 'Sign on device' }));

    await waitFor(() => {
      expect(keystoresApi.connectKeystore).toHaveBeenCalledWith(ethAccount.keystore.rootFingerprint);
      expect(ethSignSpy).toHaveBeenCalledWith(
        ethAccount.code,
        'eth sign test',
      );
    });

    expect(btcSignSpy).not.toHaveBeenCalled();
    await screen.findByText('Message signed');
  });

  it('stays on the input view when connect keystore is canceled', async () => {
    vi.mocked(keystoresApi.connectKeystore).mockResolvedValue({
      success: false,
      errorCode: 'userAbort',
    });
    const signMessageSpy = vi.spyOn(accountApi, 'signBTCMessageForAddress');
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => [
      {
        scriptType: 'p2wpkh',
        addresses: [{
          address: 'bc1qnativeexample',
          displayAddress: groupAddress('bc1qnativeexample'),
          addressID: 'native-address-id',
        }],
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

    await user.type(
      await screen.findByPlaceholderText('Enter the message to sign'),
      'connect abort test',
    );
    await user.click(screen.getByRole('button', { name: 'Sign on device' }));

    await waitFor(() => {
      expect(keystoresApi.connectKeystore).toHaveBeenCalledWith(mockAccount.keystore.rootFingerprint);
    });
    expect(signMessageSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign on device' })).toBeInTheDocument();
    expect(screen.queryByText('Could not connect to the selected device.')).not.toBeInTheDocument();
  });
});
