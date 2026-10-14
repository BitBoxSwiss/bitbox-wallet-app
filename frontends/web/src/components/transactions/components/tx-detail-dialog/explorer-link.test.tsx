// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  afterEach(() => {
    delete window.android;
    delete window.webkit;
    delete window.runningOnIOS;
    vi.useRealTimers();
  });

  const setupIOS = () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    window.runningOnIOS = true;
    window.webkit = { messageHandlers: {
      goCall: { postMessage: vi.fn() },
      appReady: { postMessage: vi.fn() },
      hapticFeedback: { postMessage: vi.fn() },
      showExplorerLinkMenu: { postMessage },
    } };
    return postMessage;
  };

  const startHold = (link: HTMLElement) => {
    fireEvent.touchStart(link, { touches: [{ clientX: 10, clientY: 10 }] });
  };

  it('disables iOS previews and requests a native menu without opening the URL', () => {
    const postMessage = setupIOS();
    render(<ExplorerLink href={url} />);
    const link = screen.getByRole('link');
    expect((link.style as CSSStyleDeclaration & { WebkitTouchCallout: string }).WebkitTouchCallout).toBe('none');
    startHold(link);
    act(() => vi.advanceTimersByTime(500));
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({
      url, copy: 'button.copy', open: 'button.openInBrowser', cancel: 'dialog.cancel',
    });
    expect(fireEvent.touchEnd(link)).toBe(false);
    fireEvent.click(link, { detail: 1 });
    expect(open).not.toHaveBeenCalled();
  });

  it('keeps normal iOS taps working after dismissing the menu', () => {
    const postMessage = setupIOS();
    render(<ExplorerLink href={url} />);
    const link = screen.getByRole('link');
    startHold(link);
    act(() => vi.advanceTimersByTime(500));
    fireEvent.touchEnd(link);
    startHold(link);
    fireEvent.touchEnd(link);
    fireEvent.click(link, { detail: 1 });
    act(() => vi.advanceTimersByTime(500));
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledExactlyOnceWith(url);
  });

  it.each(['touchEnd', 'touchCancel', 'touchMove'] as const)('cancels a pending iOS hold on %s', event => {
    const postMessage = setupIOS();
    render(<ExplorerLink href={url} />);
    const link = screen.getByRole('link');
    startHold(link);
    fireEvent[event](link, { touches: [{ clientX: 30, clientY: 10 }] });
    act(() => vi.advanceTimersByTime(500));
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('cancels the pending iOS menu when the link unmounts', () => {
    const postMessage = setupIOS();
    const { unmount } = render(<ExplorerLink href={url} />);
    startHold(screen.getByRole('link'));
    unmount();
    act(() => vi.advanceTimersByTime(500));
    expect(postMessage).not.toHaveBeenCalled();
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

  it('requests the native Android menu only for the explorer link', () => {
    const showExplorerLinkMenu = vi.fn();
    window.android = { call: vi.fn(), showExplorerLinkMenu };
    render(<ExplorerLink href={url} />);
    expect(fireEvent.contextMenu(screen.getByRole('link'))).toBe(false);
    expect(showExplorerLinkMenu).toHaveBeenCalledExactlyOnceWith({
      url, copy: 'button.copy', open: 'button.openInBrowser', openError: 'transaction.explorerError',
    });
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves shared anchors and their context-menu behavior unchanged', () => {
    const showExplorerLinkMenu = vi.fn();
    window.android = { call: vi.fn(), showExplorerLinkMenu };
    render(<A href={url}>Another external link</A>);
    const link = screen.getByText('Another external link');
    expect(link.tagName).toBe('SPAN');
    expect(link).not.toHaveAttribute('href');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(fireEvent.contextMenu(link)).toBe(true);
    expect(showExplorerLinkMenu).not.toHaveBeenCalled();
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
