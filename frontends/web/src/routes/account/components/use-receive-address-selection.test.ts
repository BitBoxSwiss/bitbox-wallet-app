// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as accountApi from '@/api/account';
import { useReceiveAddressSelection } from './use-receive-address-selection';

const makeAddress = (addressID: string, address: string): accountApi.TReceiveAddress => ({
  addressID,
  address,
});

describe('routes/account/components/use-receive-address-selection', () => {
  it('resets selected address type when available script types shrink', async () => {
    const initialReceiveAddresses: accountApi.TReceiveAddressList[] = [
      { scriptType: 'p2wpkh', addresses: [makeAddress('native-0', 'bc1qnative0')] },
      { scriptType: 'p2tr', addresses: [makeAddress('taproot-0', 'bc1ptaproot0')] },
    ];

    const { result, rerender } = renderHook(
      ({ receiveAddresses }) => useReceiveAddressSelection({ receiveAddresses }),
      { initialProps: { receiveAddresses: initialReceiveAddresses } }
    );

    await waitFor(() => {
      expect(result.current.currentAddressIndex).toBe(0);
      expect(result.current.addressType).toBe(0);
    });

    act(() => {
      result.current.handleAddressTypeChosen(1);
    });

    await waitFor(() => {
      expect(result.current.addressType).toBe(1);
      expect(result.current.currentAddressIndex).toBe(1);
      expect(result.current.currentAddresses?.[0]?.addressID).toBe('taproot-0');
    });

    const shrunkReceiveAddresses: accountApi.TReceiveAddressList[] = [
      { scriptType: 'p2wpkh', addresses: [makeAddress('native-1', 'bc1qnative1')] },
    ];
    rerender({ receiveAddresses: shrunkReceiveAddresses });

    await waitFor(() => {
      expect(result.current.addressType).toBe(0);
      expect(result.current.currentAddressIndex).toBe(0);
      expect(result.current.currentAddresses?.[0]?.addressID).toBe('native-1');
    });
  });

  it('keeps first address list selected when no known script types are available', async () => {
    const ethereumStyleReceiveAddresses: accountApi.TReceiveAddressList[] = [
      { scriptType: null, addresses: [makeAddress('eth-0', '0x1234')] },
    ];

    const { result } = renderHook(() => useReceiveAddressSelection({
      receiveAddresses: ethereumStyleReceiveAddresses,
    }));

    await waitFor(() => {
      expect(result.current.addressType).toBe(0);
      expect(result.current.currentAddressIndex).toBe(0);
      expect(result.current.currentAddresses?.[0]?.addressID).toBe('eth-0');
    });
  });
});
