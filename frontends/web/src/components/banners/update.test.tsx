// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TUpdateFile } from '@/api/version';
import { Update } from './update';

const versionApiMocks = vi.hoisted(() => ({
  getUpdate: vi.fn(),
  subscribeUpdate: vi.fn(),
}));

vi.mock('@/api/version', () => versionApiMocks);

vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: () => ({
    config: { frontend: {} },
    setConfig: vi.fn(),
  }),
}));

vi.mock('@/hooks/darkmode', () => ({
  useDarkmode: () => ({ isDarkMode: false }),
}));

const update: TUpdateFile = {
  current: '4.51.3',
  version: '4.52.0',
  description: 'A new version is ready.',
};

describe('components/banners/update', () => {
  let notifyUpdate: ((update: TUpdateFile | null) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    notifyUpdate = undefined;
    versionApiMocks.getUpdate.mockResolvedValue(null);
    versionApiMocks.subscribeUpdate.mockImplementation((cb: typeof notifyUpdate) => {
      notifyUpdate = cb;
      return () => {};
    });
  });

  it('renders a cached update', async () => {
    versionApiMocks.getUpdate.mockResolvedValue(update);

    render(<Update />);

    expect(await screen.findByText(update.description, { exact: false })).toBeInTheDocument();
    expect(versionApiMocks.subscribeUpdate).toHaveBeenCalledOnce();
  });

  it('renders an update received from the subscription', async () => {
    const { container } = render(<Update />);

    await waitFor(() => expect(versionApiMocks.subscribeUpdate).toHaveBeenCalledOnce());
    expect(container.firstChild).toBeNull();

    act(() => notifyUpdate?.(update));

    expect(screen.getByText(update.description, { exact: false })).toBeInTheDocument();
  });
});
