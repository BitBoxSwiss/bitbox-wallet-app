// SPDX-License-Identifier: Apache-2.0

import i18n from '../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TReleaseNotes } from '@/api/whats-new';
import { WhatsNew } from './whats-new';

const apiMocks = vi.hoisted(() => ({
  getWhatsNew: vi.fn(), dismissWhatsNew: vi.fn(), getWhatsNewImage: vi.fn(),
}));
const envMocks = vi.hoisted(() => ({ runningInAndroid: vi.fn(), runningInIOS: vi.fn() }));
const systemMocks = vi.hoisted(() => ({ open: vi.fn() }));
const alertMocks = vi.hoisted(() => ({ alertUser: vi.fn() }));

vi.mock('@/api/whats-new', () => apiMocks);
vi.mock('@/api/system', () => systemMocks);
vi.mock('@/utils/env', () => envMocks);
vi.mock('@/components/alert/Alert', () => alertMocks);
vi.mock('@/components/dialog/dialog', () => ({
  Dialog: ({ children, onClose, open, title }: {
    children: ReactNode;
    onClose: () => void;
    open: boolean;
    title: string;
  }) => open && (
    <div role="dialog" aria-label={title}>
      <button onClick={onClose}>close</button>
      {children}
    </div>
  ),
  DialogButtons: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogScrollContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const notes: TReleaseNotes = {
  version: '4.53.0',
  highlights: [
    {
      group: 'common',
      content: {
        en: { title: 'Settings search', description: 'Find your settings.' },
        de: { title: 'Einstellungen', description: 'Finde deine Einstellungen.' },
      },
    },
    {
      group: 'mobile', image: 'images/mobile.png',
      content: { en: { title: 'Mobile update', description: 'Mobile details.', imageAlt: 'Mobile preview' } },
    },
    {
      group: 'android',
      content: { en: { title: 'Android update', description: 'Android details.' } },
    },
    {
      group: 'common',
      content: {
        en: {
          title: 'Release blog', description: 'Find all the details.',
          link: { href: 'https://blog.bitbox.swiss/en/', text: 'Read more' },
        },
        de: {
          title: 'Blogbeitrag', description: 'Alle Details.',
          link: { href: 'https://blog.bitbox.swiss/de/', text: 'Mehr erfahren' },
        },
      },
    },
  ],
};

describe('WhatsNew', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    apiMocks.getWhatsNew.mockResolvedValue(notes);
    apiMocks.dismissWhatsNew.mockResolvedValue({ success: true });
    apiMocks.getWhatsNewImage.mockResolvedValue('data:image/png;base64,preview');
    systemMocks.open.mockResolvedValue({ success: true });
    envMocks.runningInAndroid.mockReturnValue(false);
    envMocks.runningInIOS.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips notes when the request fails without dismissing the version', async () => {
    const error = new Error('Unavailable');
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiMocks.getWhatsNew.mockRejectedValue(error);
    render(<WhatsNew />);
    await waitFor(() => expect(logError).toHaveBeenCalledWith('Could not load release notes', error));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiMocks.dismissWhatsNew).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { version: '4.53.0', highlights: [] },
    { version: '4.53.0', highlights: [notes.highlights[1]] },
  ])('does not handle absent or inapplicable notes: %j', async response => {
    const request = Promise.resolve(response);
    apiMocks.getWhatsNew.mockReturnValue(request);
    render(<WhatsNew />);
    await act(async () => {
      await request;
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiMocks.dismissWhatsNew).not.toHaveBeenCalled();
  });

  it('shows applicable Android pages and dismisses the displayed version on Done', async () => {
    envMocks.runningInAndroid.mockReturnValue(true);
    render(<WhatsNew />);
    expect(await screen.findByText('Settings search')).toBeInTheDocument();
    expect(apiMocks.getWhatsNewImage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
    expect(screen.getByText('Mobile update')).toBeInTheDocument();
    expect(await screen.findByRole('img')).toHaveAttribute('alt', 'Mobile preview');
    expect(apiMocks.getWhatsNewImage).toHaveBeenCalledWith('4.53.0', 'images/mobile.png');
    fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
    expect(screen.getByText('Android update')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'button.previous' }));
    expect(screen.getByText('Mobile update')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
    fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
    expect(screen.getByText('Release blog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'button.done' }));
    expect(apiMocks.dismissWhatsNew).toHaveBeenCalledWith('4.53.0');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses localized content and opens a localized link by keyboard without dismissing', async () => {
    await i18n.changeLanguage('de-CH');
    render(<WhatsNew />);
    expect(await screen.findByText('Einstellungen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
    fireEvent.keyDown(screen.getByRole('link', { name: 'Mehr erfahren' }), { key: 'Enter' });
    expect(systemMocks.open).toHaveBeenCalledWith('https://blog.bitbox.swiss/de/');
    expect(apiMocks.dismissWhatsNew).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps navigation available if opening a link fails', async () => {
    systemMocks.open.mockResolvedValue({ success: false, errorMessage: 'Could not open' });
    render(<WhatsNew />);
    await screen.findByText('Settings search');
    fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
    fireEvent.click(screen.getByRole('link', { name: 'Read more' }));
    await waitFor(() => expect(alertMocks.alertUser).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'button.previous' }));
    expect(screen.getByText('Settings search')).toBeInTheDocument();
    expect(apiMocks.dismissWhatsNew).not.toHaveBeenCalled();
  });

  it('shows text and navigation before an image loads, including when it fails', async () => {
    envMocks.runningInIOS.mockReturnValue(true);
    let resolveImage: (value: string) => void = () => {};
    apiMocks.getWhatsNewImage.mockReturnValue(new Promise<string>(resolve => {
      resolveImage = resolve;
    }));
    render(<WhatsNew />);
    await screen.findByText('Settings search');
    fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
    expect(screen.getByText('Mobile details.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
    expect(screen.getByText('Release blog')).toBeInTheDocument();
    await act(async () => {
      resolveImage('');
    });
    expect(screen.getByRole('button', { name: 'button.done' })).toBeEnabled();
  });

  it('records dismissal on close and stays closed during the session if persistence fails', async () => {
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiMocks.dismissWhatsNew.mockResolvedValue({ success: false, errorMessage: 'Disk full' });
    render(<WhatsNew />);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => expect(logError).toHaveBeenCalledWith('Could not dismiss release notes', 'Disk full'));
    expect(apiMocks.dismissWhatsNew).toHaveBeenCalledWith('4.53.0');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows notes again if the app closes before dismissal', async () => {
    const firstLaunch = render(<WhatsNew />);
    await screen.findByRole('dialog');
    firstLaunch.unmount();
    render(<WhatsNew />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(apiMocks.dismissWhatsNew).not.toHaveBeenCalled();
  });
});
