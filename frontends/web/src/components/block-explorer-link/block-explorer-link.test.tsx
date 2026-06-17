// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BlockExplorerLink } from './block-explorer-link';
import { open } from '@/api/system';
import type { TConfig } from '@/api/config';

vi.mock('@/i18n/i18n', () => ({
  default: {
    t: (key: string) => key,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/api/system', () => ({
  open: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: vi.fn(() => ({
    config: { frontend: { useOnionExplorerUrls: false }, backend: {} } as TConfig,
    setConfig: vi.fn(),
  })),
}));

import { useConfig } from '@/contexts/ConfigProvider';

describe('BlockExplorerLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfig).mockReturnValue({
      config: { frontend: { useOnionExplorerUrls: false }, backend: {} } as TConfig,
      setConfig: vi.fn(),
    });
  });

  it('opens clearnet URL when onion explorer URLs are disabled', async () => {
    const user = userEvent.setup();

    render(
      <BlockExplorerLink
        prefix="https://mempool.space/tx/"
        id="abc123">
        Open explorer
      </BlockExplorerLink>,
    );

    await user.click(screen.getByText('Open explorer'));

    expect(open).toHaveBeenCalledWith('https://mempool.space/tx/abc123');
  });

  it('opens onion URL when onion explorer URLs are enabled', async () => {
    vi.mocked(useConfig).mockReturnValue({
      config: { frontend: { useOnionExplorerUrls: true }, backend: {} } as TConfig,
      setConfig: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <BlockExplorerLink
        prefix="https://mempool.space/tx/"
        id="abc123">
        Open explorer
      </BlockExplorerLink>,
    );

    await user.click(screen.getByText('Open explorer'));

    expect(open).toHaveBeenCalledWith(
      'http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/tx/abc123',
    );
  });
});
