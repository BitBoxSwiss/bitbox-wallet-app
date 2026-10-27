// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceInfo, getDeviceInfo, getStatus, getVersion, setDeviceLanguage, statusChanged, verifyAttestation } from '@/api/bitbox02';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import type { TWalletSetupChoices } from './setup/choose';
import { Wizard } from './wizard';

const i18n = vi.hoisted(() => ({ language: 'de-DE', resolvedLanguage: 'de' }));
vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t, i18n }) };
});
vi.mock('@/api/bitbox02', () => ({
  getDeviceInfo: vi.fn(),
  getStatus: vi.fn(),
  getVersion: vi.fn(),
  setDeviceLanguage: vi.fn(),
  verifyAttestation: vi.fn(),
  statusChanged: vi.fn(() => vi.fn()),
  attestationCheckDone: vi.fn(() => vi.fn()),
}));
vi.mock('@/components/layout', () => ({ Main: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/spinner/Spinner', () => ({ Spinner: () => <div role="status">Loading</div> }));
vi.mock('@/components/appupgraderequired', () => ({ AppUpgradeRequired: () => null }));
vi.mock('@/routes/device/upgrade-firmware-required', () => ({ FirmwareUpgradeRequired: () => null }));
vi.mock('./unlock', () => ({ Unlock: () => null }));
vi.mock('./setup/pairing', () => ({ Pairing: () => null }));
vi.mock('./setup/success', () => ({
  CreateWalletSuccess: () => null,
  RestoreFromSDCardSuccess: () => null,
  RestoreFromMnemonicSuccess: () => null,
}));
vi.mock('./setup/choose', () => ({
  SetupOptions: ({ onSelectSetup }: {
    onSelectSetup: (type: TWalletSetupChoices) => void;
  }) => (
    <>
      {(['create-wallet', 'restore-sdcard', 'restore-mnemonic'] as const).map(type => (
        <button key={type} onClick={() => onSelectSetup(type)}>{type}</button>
      ))}
    </>
  ),
}));
vi.mock('./setup/wallet-create', () => ({
  CreateWallet: () => <h1>create-wallet</h1>,
}));
vi.mock('./setup/wallet-restore', () => ({
  RestoreFromSDCard: () => <h1>restore-sdcard</h1>,
  RestoreFromMnemonic: () => <h1>restore-mnemonic</h1>,
}));

const info = (overrides: Partial<DeviceInfo> = {}) => ({
  success: true as const,
  deviceInfo: {
    initialized: false,
    language: 'en',
    supportedLanguages: ['en', 'de'],
    name: 'BitBox',
    mnemonicPassphraseEnabled: false,
    securechipModel: 'ATECC608B',
    version: '9.28.0',
    bluetooth: null,
    ...overrides,
  },
});

describe('setup language', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.language = 'de-DE';
    i18n.resolvedLanguage = 'de';
    vi.mocked(getStatus).mockResolvedValue('uninitialized');
    vi.mocked(getVersion).mockResolvedValue({
      currentVersion: '9.28.0', canUpgrade: false, canGotoStartupSettings: false,
      canBackupWithRecoveryWords: true, canCreate12Words: true, canChangePassword: true, canBIP85: true,
    });
    vi.mocked(verifyAttestation).mockResolvedValue(true);
    vi.mocked(getDeviceInfo).mockResolvedValue(info());
    vi.mocked(setDeviceLanguage).mockResolvedValue({ success: true });
  });

  // The language request finishes before any choice appears; selecting a path does not send it again.
  it.each(['create-wallet', 'restore-sdcard', 'restore-mnemonic'])(
    'sets the language before showing the %s choice', async choice => {
      const user = userEvent.setup();
      const pending = Promise.withResolvers<{ success: true }>();
      vi.mocked(setDeviceLanguage).mockReturnValueOnce(pending.promise);
      render(<Wizard deviceID="device-1" />);
      await waitFor(() => expect(setDeviceLanguage).toHaveBeenCalledExactlyOnceWith('device-1', 'de'));
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      await act(async () => pending.resolve({ success: true }));
      await user.click(screen.getByRole('button', { name: choice }));
      expect(screen.getByRole('heading', { name: choice })).toBeInTheDocument();
      expect(getDeviceInfo).toHaveBeenCalledTimes(1);
      expect(setDeviceLanguage).toHaveBeenCalledTimes(1);
    }
  );

  // Unavailable languages and already-selected targets, including the English fallback, require no write.
  it.each([
    { supportedLanguages: undefined, language: undefined },
    { supportedLanguages: [], language: 'de' },
    { supportedLanguages: ['en'] },
    { supportedLanguages: ['fr'], language: 'fr' },
    { language: 'de' },
  ])('skips an unnecessary language request: %j', async overrides => {
    vi.mocked(getDeviceInfo).mockResolvedValue(info(overrides));
    render(<Wizard deviceID="device-1" />);
    expect(await screen.findByRole('button', { name: 'create-wallet' })).toBeInTheDocument();
    expect(setDeviceLanguage).not.toHaveBeenCalled();
  });

  // Fresh device information prevents showing setup choices or changing language on an initialized device.
  it('stops when the device is already initialized', async () => {
    vi.mocked(getDeviceInfo).mockResolvedValue(info({ initialized: true }));
    await act(async () => {
      render(<Wizard deviceID="device-1" />);
    });
    expect(getDeviceInfo).toHaveBeenCalledTimes(1);
    expect(setDeviceLanguage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // A failed read or write offers Retry and keeps choices hidden until retrying applies the language.
  it.each(['info', 'language', 'network'])('allows retry after a %s failure', async failure => {
    const user = userEvent.setup();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    if (failure === 'info') {
      vi.mocked(getDeviceInfo).mockResolvedValueOnce({ success: false });
    } else if (failure === 'language') {
      vi.mocked(setDeviceLanguage).mockResolvedValueOnce({ success: false });
    } else {
      vi.mocked(getDeviceInfo).mockRejectedValueOnce(new Error('disconnected'));
    }
    render(<Wizard deviceID="device-1" />);
    expect(await screen.findByRole('heading', { name: 'genericError' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'create-wallet' })).not.toBeInTheDocument();
    expect(getDeviceInfo).toHaveBeenCalledTimes(1);
    vi.mocked(setDeviceLanguage).mockClear();
    const pending = Promise.withResolvers<ReturnType<typeof info>>();
    vi.mocked(getDeviceInfo).mockReturnValueOnce(pending.promise);
    await user.click(screen.getByRole('button', { name: 'generic.retry' }));
    expect(screen.queryByRole('heading', { name: 'genericError' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(getDeviceInfo).toHaveBeenCalledTimes(2);
    await act(async () => pending.resolve(info()));
    expect(await screen.findByRole('button', { name: 'create-wallet' })).toBeInTheDocument();
    expect(setDeviceLanguage).toHaveBeenCalledExactlyOnceWith('device-1', 'de');
    log.mockRestore();
  });

  // System Back must not dismiss the error and leave setup stuck without a retry control.
  it('keeps Retry available after system Back', async () => {
    const user = userEvent.setup();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getDeviceInfo).mockResolvedValueOnce({ success: false });
    render(
      <BackButtonProvider>
        <Wizard deviceID="device-1" />
      </BackButtonProvider>
    );
    await screen.findByRole('button', { name: 'generic.retry' });
    expect(window.onBackButtonPressed).toBeTypeOf('function');
    act(() => {
      window.onBackButtonPressed?.();
    });
    await user.click(screen.getByRole('button', { name: 'generic.retry' }));
    expect(await screen.findByRole('button', { name: 'create-wallet' })).toBeInTheDocument();
    log.mockRestore();
  });

  // Reconnecting before backup completion selects English for an English app or as fallback for unsupported Italian.
  it.each([
    ['en-GB', 'en'],
    ['it-IT', 'it'],
  ])('selects English after reconnecting unfinished setup with %s', async (appLanguage, resolvedLanguage) => {
    const user = userEvent.setup();
    const first = render(<Wizard deviceID="device-1" />);
    await user.click(await screen.findByRole('button', { name: 'create-wallet' }));
    await screen.findByRole('heading', { name: 'create-wallet' });
    first.unmount();
    i18n.language = appLanguage;
    i18n.resolvedLanguage = resolvedLanguage;
    vi.mocked(getDeviceInfo).mockResolvedValue(info({ language: 'de' }));
    render(<Wizard deviceID="device-2" />);
    await screen.findByRole('button', { name: 'create-wallet' });
    expect(setDeviceLanguage).toHaveBeenNthCalledWith(2, 'device-2', 'en');
  });

  // A late info response from a disconnected device must not trigger a language write.
  it('does not send a language request after unmounting', async () => {
    const pending = Promise.withResolvers<ReturnType<typeof info>>();
    vi.mocked(getDeviceInfo).mockReturnValueOnce(pending.promise);
    const view = render(<Wizard deviceID="device-1" />);
    await waitFor(() => expect(getDeviceInfo).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    view.unmount();
    await act(async () => pending.resolve(info()));
    expect(setDeviceLanguage).not.toHaveBeenCalled();
  });

  // A normal initialized connection never starts automatic language selection.
  it('does not prepare setup for an initialized connection', async () => {
    vi.mocked(getStatus).mockResolvedValue('initialized');
    await act(async () => {
      render(<Wizard deviceID="device-1" />);
    });
    expect(getDeviceInfo).not.toHaveBeenCalled();
    expect(setDeviceLanguage).not.toHaveBeenCalled();
  });

  // Pairing and unlocking must finish before language selection; both unfinished setup states trigger it.
  it.each(['uninitialized', 'seeded'] as const)('prepares setup when the device becomes %s', async status => {
    vi.mocked(getStatus).mockResolvedValue('connected');
    await act(async () => {
      render(<Wizard deviceID="device-1" />);
    });
    expect(getDeviceInfo).not.toHaveBeenCalled();
    await act(async () => vi.mocked(statusChanged).mock.calls[0]?.[1](status));
    expect(await screen.findByRole('button', { name: 'create-wallet' })).toBeInTheDocument();
    expect(setDeviceLanguage).toHaveBeenCalledExactlyOnceWith('device-1', 'de');
  });
});
