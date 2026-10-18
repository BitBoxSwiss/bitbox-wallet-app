// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runningInQtWebEngine } from './env';

const { backend, QWebChannel } = vi.hoisted(() => {
  const backend = {
    gotResponse: { connect: vi.fn() },
    pushNotify: { connect: vi.fn() },
    saveAppearancePreset: vi.fn(),
  };
  return {
    backend,
    QWebChannel: vi.fn(function (_transport, initialize) {
      initialize({ objects: { backend } });
    }),
  };
});

vi.mock('./env', () => ({ runningInQtWebEngine: vi.fn(() => true) }));
vi.mock('./qwebchannel', () => ({ QWebChannel }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.mocked(runningInQtWebEngine).mockReturnValue(true);
  vi.stubGlobal('qt', { webChannelTransport: {} });
});
afterEach(() => vi.unstubAllGlobals());

// Export awaits the general bridge result without requiring a CSD object or its initialization.
it.each(['saved', 'cancelled', 'error'] as const)('returns the asynchronous %s preset result', async result => {
  const { saveDesktopAppearancePreset } = await import('./transport-qt');
  const pending = saveDesktopAppearancePreset('{"profiles":{}}', 'Export');
  await Promise.resolve();
  expect(backend.saveAppearancePreset).toHaveBeenCalledWith('{"profiles":{}}', 'Export', expect.any(Function));
  backend.saveAppearancePreset.mock.calls[0]![2](result);
  await expect(pending).resolves.toBe(result);
  expect(QWebChannel).toHaveBeenCalledTimes(1);
});

// Browser/mobile callers must not initialize a Qt transport to export a desktop-only preset.
it('returns an error outside Qt without connecting', async () => {
  vi.mocked(runningInQtWebEngine).mockReturnValue(false);
  const { saveDesktopAppearancePreset } = await import('./transport-qt');
  await expect(saveDesktopAppearancePreset('{}', 'Export')).resolves.toBe('error');
  expect(QWebChannel).not.toHaveBeenCalled();
});
