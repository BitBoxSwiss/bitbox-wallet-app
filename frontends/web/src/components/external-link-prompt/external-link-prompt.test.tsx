// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import i18n from 'i18next';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { defaultLanguages } from '@/components/language/types';
import type { TExternalLinkRequest } from '@/api/system';
import { ExternalLinkPrompt } from './external-link-prompt';

const systemMocks = vi.hoisted(() => ({
  openExternalLink: vi.fn(),
  subscribeExternalLinkRequests: vi.fn(),
}));

vi.mock('@/api/system', () => systemMocks);

type TAppTranslations = {
  externalLinkPrompt?: {
    confirm?: string;
    message?: string;
    title?: string;
  };
};

const localeTranslations = import.meta.glob<TAppTranslations>('../../locales/*/app.json', {
  eager: true,
  import: 'default',
});

describe('ExternalLinkPrompt', () => {
  let requestExternalLink: (request: TExternalLinkRequest) => void;

  beforeAll(() => {
    window.matchMedia = (
      window.matchMedia || (() => ({
        addEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: '',
        onchange: null,
        removeEventListener: vi.fn(),
      }))
    );
    i18n.addResourceBundle('en', 'translation', {
      dialog: { cancel: 'Cancel' },
      externalLinkPrompt: {
        confirm: 'Proceed',
        message: 'You are about to open URL {{url}} in your system browser. Proceed?',
        title: 'Open external link',
      },
    }, true, true);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    systemMocks.openExternalLink.mockResolvedValue({ success: true });
    systemMocks.subscribeExternalLinkRequests.mockImplementation((callback) => {
      requestExternalLink = callback;
      return vi.fn();
    });
  });

  it('opens the URL displayed by the active prompt when requests overlap', async () => {
    render(
      <BackButtonProvider>
        <ExternalLinkPrompt />
      </BackButtonProvider>
    );

    const displayedURL = 'https://pocketbitcoin.com/verify?id=first';
    const overlappingURL = 'https://pocketbitcoin.com/verify?id=second';
    act(() => {
      requestExternalLink({ url: displayedURL });
      requestExternalLink({ url: overlappingURL });
    });

    expect(await screen.findByText(
      `You are about to open URL ${displayedURL} in your system browser. Proceed?`
    )).toBeInTheDocument();
    expect(screen.queryByText(
      `You are about to open URL ${overlappingURL} in your system browser. Proceed?`
    )).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Proceed' }));

    expect(systemMocks.openExternalLink).toHaveBeenCalledOnce();
    expect(systemMocks.openExternalLink).toHaveBeenCalledWith(displayedURL);
  });

  it('has complete prompt translations for every supported language', () => {
    defaultLanguages.forEach(({ code }) => {
      const translations = localeTranslations[`../../locales/${code}/app.json`];
      expect(translations, code).toBeDefined();
      expect(translations?.externalLinkPrompt?.confirm, code).toBeTruthy();
      expect(translations?.externalLinkPrompt?.message, code).toContain('{{url}}');
      expect(translations?.externalLinkPrompt?.title, code).toBeTruthy();
    });
  });
});
