// SPDX-License-Identifier: Apache-2.0

import '../../../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { AccountCode, ScriptType, TReceiveAddress, TReceiveAddressList } from '@/api/account';
import type { NonEmptyArray } from '@/utils/types';

vi.mock('@/i18n/i18n');
vi.mock('@/hooks/api', () => ({
  useLoad: vi.fn(),
}));

import { useLoad } from '@/hooks/api';
import { useReceiveAddresses } from './use-receive-addresses';

const mockUseLoad = vi.mocked(useLoad);

const addr = (id: string): TReceiveAddress => ({
  addressID: id,
  address: `bc1q${id}`,
  displayAddress: `bc1q ${id}`,
});

const makeGroup = (
  scriptType: ScriptType | null,
  ...ids: string[]
): TReceiveAddressList => ({
  scriptType,
  addresses: [addr(ids[0]!), ...ids.slice(1).map(addr)] as NonEmptyArray<TReceiveAddress>,
});

const CODE = 'btc-acct' as AccountCode;

describe('useReceiveAddresses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoad.mockReturnValue(undefined);
  });

  it('returns empty/undefined values while loading', () => {
    const { result } = renderHook(() => useReceiveAddresses(CODE, undefined));
    expect(result.current.availableScriptTypes).toEqual([]);
    expect(result.current.addresses).toBeUndefined();
    expect(result.current.currentAddress).toBeUndefined();
    expect(result.current.hasMultipleScriptTypes).toBe(false);
    expect(result.current.hasMultipleAddresses).toBe(false);
  });

  it('derives availableScriptTypes in priority order', () => {
    const data: NonEmptyArray<TReceiveAddressList> = [
      makeGroup('p2wpkh-p2sh', 'a1'),
      makeGroup('p2tr', 'b1'),
      makeGroup('p2wpkh', 'c1'),
    ];
    mockUseLoad.mockReturnValue(data);
    const { result } = renderHook(() => useReceiveAddresses(CODE, undefined));
    expect(result.current.availableScriptTypes).toEqual(['p2wpkh', 'p2tr', 'p2wpkh-p2sh']);
  });

  it('selects preferred script type index', () => {
    const data: NonEmptyArray<TReceiveAddressList> = [
      makeGroup('p2wpkh', 'a1'),
      makeGroup('p2tr', 'b1'),
    ];
    mockUseLoad.mockReturnValue(data);
    const { result } = renderHook(() => useReceiveAddresses(CODE, 'p2tr'));
    expect(result.current.addressTypeIndex).toBe(1);
    expect(result.current.currentAddress?.addressID).toBe('b1');
  });

  it('falls back to index 0 when preferred type is unavailable', () => {
    const data: NonEmptyArray<TReceiveAddressList> = [
      makeGroup('p2wpkh', 'a1'),
    ];
    mockUseLoad.mockReturnValue(data);
    const { result } = renderHook(() => useReceiveAddresses(CODE, 'p2tr'));
    expect(result.current.addressTypeIndex).toBe(0);
    expect(result.current.currentAddress?.addressID).toBe('a1');
  });

  it('falls back to index 0 when preferredScriptType is undefined', () => {
    const data: NonEmptyArray<TReceiveAddressList> = [
      makeGroup('p2wpkh', 'a1'),
      makeGroup('p2tr', 'b1'),
    ];
    mockUseLoad.mockReturnValue(data);
    const { result } = renderHook(() => useReceiveAddresses(CODE, undefined));
    expect(result.current.addressTypeIndex).toBe(0);
    expect(result.current.currentAddress?.addressID).toBe('a1');
  });

  it('reports hasMultipleScriptTypes correctly', () => {
    const single: NonEmptyArray<TReceiveAddressList> = [makeGroup('p2wpkh', 'a1')];
    const multi: NonEmptyArray<TReceiveAddressList> = [
      makeGroup('p2wpkh', 'a1'),
      makeGroup('p2tr', 'b1'),
    ];

    mockUseLoad.mockReturnValue(single);
    const { result: r1 } = renderHook(() => useReceiveAddresses(CODE, undefined));
    expect(r1.current.hasMultipleScriptTypes).toBe(false);

    mockUseLoad.mockReturnValue(multi);
    const { result: r2 } = renderHook(() => useReceiveAddresses(CODE, undefined));
    expect(r2.current.hasMultipleScriptTypes).toBe(true);
  });

  it('reports hasMultipleAddresses correctly', () => {
    const single: NonEmptyArray<TReceiveAddressList> = [makeGroup('p2wpkh', 'a1')];
    const multi: NonEmptyArray<TReceiveAddressList> = [makeGroup('p2wpkh', 'a1', 'a2')];

    mockUseLoad.mockReturnValue(single);
    const { result: r1 } = renderHook(() => useReceiveAddresses(CODE, undefined));
    expect(r1.current.hasMultipleAddresses).toBe(false);

    mockUseLoad.mockReturnValue(multi);
    const { result: r2 } = renderHook(() => useReceiveAddresses(CODE, undefined));
    expect(r2.current.hasMultipleAddresses).toBe(true);
  });

  it('setActiveIndex changes currentAddress', () => {
    const data: NonEmptyArray<TReceiveAddressList> = [makeGroup('p2wpkh', 'a1', 'a2', 'a3')];
    mockUseLoad.mockReturnValue(data);
    const { result } = renderHook(() => useReceiveAddresses(CODE, undefined));
    expect(result.current.currentAddress?.addressID).toBe('a1');

    act(() => result.current.setActiveIndex(2));
    expect(result.current.currentAddress?.addressID).toBe('a3');
  });

  it('setAddressTypeIndex switches address group and resets activeIndex', () => {
    const data: NonEmptyArray<TReceiveAddressList> = [
      makeGroup('p2wpkh', 'a1', 'a2'),
      makeGroup('p2tr', 'b1', 'b2'),
    ];
    mockUseLoad.mockReturnValue(data);
    const { result } = renderHook(() => useReceiveAddresses(CODE, undefined));

    act(() => result.current.setActiveIndex(1));
    expect(result.current.currentAddress?.addressID).toBe('a2');

    act(() => result.current.setAddressTypeIndex(1));
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.currentAddress?.addressID).toBe('b1');
  });

  it('filters out script types not in priority list', () => {
    const data: NonEmptyArray<TReceiveAddressList> = [
      makeGroup('p2pkh' as ScriptType, 'old1'),
      makeGroup('p2wpkh', 'a1'),
    ];
    mockUseLoad.mockReturnValue(data);
    const { result } = renderHook(() => useReceiveAddresses(CODE, undefined));
    expect(result.current.availableScriptTypes).toEqual(['p2wpkh']);
  });

  it('handles null scriptType groups gracefully', () => {
    const data: NonEmptyArray<TReceiveAddressList> = [makeGroup(null, 'eth1')];
    mockUseLoad.mockReturnValue(data);
    const { result } = renderHook(() => useReceiveAddresses(CODE, undefined));
    expect(result.current.availableScriptTypes).toEqual([]);
    expect(result.current.currentAddress?.addressID).toBe('eth1');
  });
});
