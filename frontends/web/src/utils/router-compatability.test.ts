
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLocation as useLocationWouter } from 'wouter';
import { useLocation } from './router-compatability';

vi.mock('wouter', async (importOriginal) => ({
  ...await importOriginal<typeof import('wouter')>(),
  useLocation: vi.fn(),
}));

const mockUseLocationWouter = vi.mocked(useLocationWouter);

describe('useLocation', () => {
  const originalLocation = Object.getOwnPropertyDescriptor(
    window,
    'location',
  );

  const mockWindowLocation = (
    href: string,
    origin: string,
    hash = '',
  ) => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href, origin, hash },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocationWouter.mockReturnValue(['/settings', vi.fn()]);
  });

  afterEach(() => {
    if (originalLocation) {
      Object.defineProperty(window, 'location', originalLocation);
    }
  });

  it.each([
    {
      name: 'HTTPS domain',
      href: 'https://app.example.com/index.html',
      origin: 'https://app.example.com',
      expected: 'https://app.example.com/settings',
    },
    {
      name: 'HTTP domain',
      href: 'http://example.com/index.html',
      origin: 'http://example.com',
      expected: 'http://example.com/settings',
    },
    {
      name: 'localhost',
      href: 'http://localhost:3000/index.html',
      origin: 'http://localhost:3000',
      expected: 'http://localhost:3000/settings',
    },
    {
      name: 'localhost HTTPS',
      href: 'https://localhost:8080/index.html',
      origin: 'https://localhost:8080',
      expected: 'https://localhost:8080/settings',
    },
    {
      name: 'Qt bitboxapp scheme',
      href: 'bitboxapp:/index.html',
      origin: 'bitboxapp:',
      expected: 'bitboxapp:/settings',
    },
    {
      name: 'Qt bitboxapp nested path',
      href: 'bitboxapp:/app/index.html',
      origin: 'bitboxapp:',
      expected: 'bitboxapp:/settings',
    },
  ])('resolves routes with $name', ({ href, origin, expected }) => {
    mockWindowLocation(href, origin);

    const { result } = renderHook(() => useLocation());

    expect(result.current).toBeInstanceOf(URL);
    expect(result.current.href).toBe(expected);
  });

  it('preserves search parameters', () => {
    mockWindowLocation(
      'https://app.example.com/index.html',
      'https://app.example.com',
      '#/settings?account=123&tab=transactions',
    );

    const { result } = renderHook(() => useLocation());

    expect(result.current.pathname).toBe('/settings');
    expect(result.current.search).toBe(
      '?account=123&tab=transactions',
    );
    expect(result.current.searchParams.get('account')).toBe('123');
    expect(result.current.searchParams.get('tab')).toBe('transactions');
  });

  it('preserves search parameters with Qt custom scheme', () => {
    mockWindowLocation(
      'bitboxapp:/index.html',
      'bitboxapp:',
      '#/settings?account=123',
    );

    const { result } = renderHook(() => useLocation());

    expect(result.current.href).toBe(
      'bitboxapp:/settings?account=123',
    );
  });

  it('throws when both origin and href are invalid', () => {
    mockWindowLocation('invalid-url', 'invalid-origin');

    expect(() => renderHook(() => useLocation())).toThrow(TypeError);
  });

  it('throws when the route cannot be resolved', () => {
    mockWindowLocation(
      'https://app.example.com/index.html',
      'https://app.example.com',
    );
    mockUseLocationWouter.mockReturnValue([
      'http://[invalid',
      vi.fn(),
    ]);

    expect(() => renderHook(() => useLocation())).toThrow(TypeError);
  });

  it('returns an empty search when the hash has no query', () => {
    mockWindowLocation(
      'bitboxapp:/index.html',
      'bitboxapp:',
      '#/settings',
    );

    const { result } = renderHook(() => useLocation());

    expect(result.current.pathname).toBe('/settings');
    expect(result.current.search).toBe('');
  });

  it('uses hash search parameters instead of document search parameters', () => {
    mockWindowLocation(
      'https://app.example.com/index.html?document=1',
      'https://app.example.com',
      '#/settings?account=123',
    );

    const { result } = renderHook(() => useLocation());

    expect(result.current.search).toBe('?account=123');
    expect(result.current.searchParams.has('document')).toBe(false);
  });

  it('falls back to href when origin is invalid', () => {
    mockWindowLocation(
      'https://app.example.com/index.html',
      'invalid-origin',
    );

    const { result } = renderHook(() => useLocation());

    expect(result.current.href).toBe(
      'https://app.example.com/settings',
    );
  });

});
