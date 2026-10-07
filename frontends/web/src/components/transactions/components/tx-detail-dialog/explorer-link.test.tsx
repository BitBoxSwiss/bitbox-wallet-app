// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { open } from '@/api/system';
import { alertUser } from '@/components/alert/Alert';
import { A } from '@/components/anchor/anchor';
import { ExplorerLink } from './explorer-link';

vi.mock('@/api/system', () => ({ open: vi.fn() }));
vi.mock('@/components/alert/Alert', () => ({ alertUser: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const url = 'https://mempool.space/testnet/tx/example-transaction';

describe('transaction explorer link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(open).mockResolvedValue({ success: true });
  });

  it('exposes the full URL to native link menus without opening it', () => {
    render(<ExplorerLink href={url} />);
    const link = screen.getByRole('link', { name: 'transaction.explorerTitle' });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(fireEvent.contextMenu(link)).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves shared anchors and their context-menu behavior unchanged', () => {
    render(<A href={url}>Another external link</A>);
    const link = screen.getByText('Another external link');
    expect(link.tagName).toBe('SPAN');
    expect(link).not.toHaveAttribute('href');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(fireEvent.contextMenu(link)).toBe(true);
    expect(fireEvent.click(link)).toBe(false);
    expect(open).toHaveBeenCalledExactlyOnceWith(url);
  });

  it('opens through the existing API on tap without navigating the WebView', () => {
    render(<ExplorerLink href={url} />);
    expect(fireEvent.click(screen.getByRole('link'))).toBe(false);
    expect(open).toHaveBeenCalledExactlyOnceWith(url);
  });

  it('opens through the existing API when activated with the keyboard', async () => {
    const user = userEvent.setup();
    render(<ExplorerLink href={url} />);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(open).toHaveBeenCalledExactlyOnceWith(url);
  });

  it('still reports failures to open the link', async () => {
    vi.mocked(open).mockResolvedValue({ success: false, errorMessage: '' });
    render(<ExplorerLink href={url} />);
    fireEvent.click(screen.getByRole('link'));
    await waitFor(() => expect(alertUser).toHaveBeenCalledWith('genericError'));
  });
});
