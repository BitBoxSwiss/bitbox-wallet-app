// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Vasp } from './vasp';

describe('components/aopp/vasp', () => {
  it('shows known VASP branding for exact hostnames', () => {
    render(<Vasp hostname="bitcoinsuisse.com" />);

    expect(screen.getByRole('img', { name: 'bitcoinsuisse.com' })).toBeInTheDocument();
    expect(screen.getByText('bitcoinsuisse.com')).toBeInTheDocument();
  });

  it('shows known VASP branding for subdomains with a dot boundary', () => {
    render(<Vasp hostname="login.bitcoinsuisse.com" />);

    expect(screen.getByRole('img', { name: 'bitcoinsuisse.com' })).toBeInTheDocument();
    expect(screen.getByText('bitcoinsuisse.com')).toBeInTheDocument();
    expect(screen.getByText('login.bitcoinsuisse.com')).toBeInTheDocument();
  });

  it('does not show known VASP branding for host suffix spoofs', () => {
    render(<Vasp hostname="evilbitcoinsuisse.com" />);

    expect(screen.queryByRole('img', { name: 'bitcoinsuisse.com' })).not.toBeInTheDocument();
    expect(screen.getByText('evilbitcoinsuisse.com')).toBeInTheDocument();
  });
});
