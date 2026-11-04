// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getConfig, setConfig, type TConfig } from '@/api/config';
import { getLightningLoggingRestartRequired } from '@/api/lightning';
import { ConfigProvider } from '@/contexts/ConfigProvider';
import { LightningContext } from '@/contexts/LightningContext';
import { useMediaQuery } from '@/hooks/mediaquery';
import en from '@/locales/en/app.json';
import { LightningLogLevelSetting } from './lightning-log-level-setting';

vi.mock('@/api/config', () => ({ getConfig: vi.fn(), setConfig: vi.fn() }));
vi.mock('@/api/lightning', () => ({ getLightningLoggingRestartRequired: vi.fn() }));
vi.mock('@/hooks/mediaquery', () => ({ useMediaQuery: vi.fn(() => false) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key.split('.').reduce((value: any, part) => value?.[part], en) ?? key,
  }),
}));

const config = { backend: { lightningDebugLogs: false }, frontend: {} } as TConfig;
let savedConfig: TConfig;
let activeDebugLogs: boolean | undefined;

const renderSetting = () => render(<LightningLogLevelSetting />, { wrapper: ConfigProvider });

describe('LightningLogLevelSetting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    savedConfig = config;
    activeDebugLogs = false;
    vi.mocked(useMediaQuery).mockReturnValue(false);
    vi.mocked(getConfig).mockImplementation(async () => savedConfig);
    vi.mocked(getLightningLoggingRestartRequired).mockImplementation(async () => (
      activeDebugLogs !== undefined && activeDebugLogs !== savedConfig.backend.lightningDebugLogs
    ));
    vi.mocked(setConfig).mockImplementation(async nextConfig => {
      savedConfig = nextConfig;
    });
  });

  // The toggle stays hidden until the saved logging preference is available.
  it('waits for config before showing the toggle', () => {
    vi.mocked(getConfig).mockReturnValue(new Promise(() => {}));
    renderSetting();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // Both saved preferences render without a restart notice when they match the active filter.
  it.each([false, true])('shows the saved %s preference without a restart banner initially', async enabled => {
    activeDebugLogs = enabled;
    savedConfig = {
      ...config,
      backend: { ...config.backend, lightningDebugLogs: enabled },
    };
    renderSetting();
    const toggle = await screen.findByRole('checkbox', { name: 'Enable Lightning debug logs' });
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveProperty('checked', enabled);
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();
  });

  // The checkbox persists its boolean value through the shared config flow.
  it.each([false, true])('saves %s through the shared config flow', async value => {
    activeDebugLogs = !value;
    savedConfig = {
      ...config,
      backend: { ...config.backend, lightningDebugLogs: !value },
    };
    const user = userEvent.setup();
    renderSetting();
    await user.click(await screen.findByRole('checkbox', { name: 'Enable Lightning debug logs' }));
    expect(setConfig).toHaveBeenCalledWith({
      ...config,
      backend: { ...config.backend, lightningDebugLogs: value },
    });
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', value);
  });

  // Pending saves must not change the toggle or request a restart before persistence succeeds.
  it('shows the restart banner only after the change is saved', async () => {
    let finishSave!: () => void;
    vi.mocked(setConfig).mockImplementationOnce(nextConfig => new Promise<void>(resolve => {
      finishSave = () => {
        savedConfig = nextConfig;
        resolve();
      };
    }));
    const user = userEvent.setup();
    renderSetting();
    await user.click(await screen.findByRole('checkbox', { name: 'Enable Lightning debug logs' }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();

    await act(async () => finishSave());
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();
  });

  // Small screens expose the same checkbox directly in the settings row.
  it('toggles debug logging on mobile', async () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    const user = userEvent.setup();
    renderSetting();
    await user.click(await screen.findByRole('checkbox', { name: 'Enable Lightning debug logs' }));
    expect(setConfig).toHaveBeenCalledWith({
      ...config,
      backend: { ...config.backend, lightningDebugLogs: true },
    });
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  // Navigation rechecks the backend and preserves the notice until the active preference is restored.
  it('keeps the restart banner after leaving settings and clears it when the preference is restored', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSetting();
    await user.click(await screen.findByRole('checkbox', { name: 'Enable Lightning debug logs' }));
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();

    rerender(<></>);
    rerender(<LightningLogLevelSetting />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Enable Lightning debug logs' }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await waitFor(() => expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument());

    rerender(<></>);
    rerender(<LightningLogLevelSetting />);
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();
  });

  // A save completing after unmount still shows its restart notice when settings reopen.
  it('keeps the restart banner when saving finishes after leaving settings', async () => {
    let finishSave!: () => void;
    vi.mocked(setConfig).mockImplementationOnce(nextConfig => new Promise<void>(resolve => {
      finishSave = () => {
        savedConfig = nextConfig;
        resolve();
      };
    }));
    const user = userEvent.setup();
    const { rerender } = renderSetting();
    await user.click(await screen.findByRole('checkbox', { name: 'Enable Lightning debug logs' }));
    rerender(<></>);

    await act(async () => finishSave());
    rerender(<LightningLogLevelSetting />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();
  });

  // A WebView reload replaces ConfigProvider while the backend retains its active logging filter.
  it.each([false, true])('keeps the pending %s change after a full frontend remount', async value => {
    activeDebugLogs = !value;
    savedConfig = { ...config, backend: { ...config.backend, lightningDebugLogs: !value } };
    const user = userEvent.setup();
    const { unmount } = renderSetting();
    await user.click(await screen.findByRole('checkbox', { name: 'Enable Lightning debug logs' }));
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();

    unmount();
    renderSetting();
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', value);

    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument());
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', !value);
  });

  // After a backend restart applies the saved preference, the frontend must stop requesting one.
  it('clears the notice after a backend restart applies the preference', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSetting();
    await user.click(await screen.findByRole('checkbox', { name: 'Enable Lightning debug logs' }));
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();

    unmount();
    activeDebugLogs = savedConfig.backend.lightningDebugLogs;
    renderSetting();
    expect(await screen.findByRole('checkbox')).toBeChecked();
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();
  });

  // Before logging initializes, changes need no restart because the SDK can use the saved value.
  it('does not request a restart before logging initializes', async () => {
    activeDebugLogs = undefined;
    const user = userEvent.setup();
    renderSetting();
    await user.click(await screen.findByRole('checkbox', { name: 'Enable Lightning debug logs' }));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();
  });

  // SDK initialization can finish after settings load, so its status change must refresh the notice.
  it('rechecks the pending restart when SDK initialization finishes', async () => {
    activeDebugLogs = undefined;
    savedConfig = { ...config, backend: { ...config.backend, lightningDebugLogs: true } };
    const { rerender } = render(
      <LightningContext.Provider value={{
        isLightningReady: false, lightningAccount: null, lightningSDKStatus: 'initializing',
      }}>
        <LightningLogLevelSetting />
      </LightningContext.Provider>,
      { wrapper: ConfigProvider },
    );
    expect(await screen.findByRole('checkbox')).toBeChecked();
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();

    activeDebugLogs = false;
    rerender(
      <LightningContext.Provider value={{
        isLightningReady: true, lightningAccount: null, lightningSDKStatus: 'ready',
      }}>
        <LightningLogLevelSetting />
      </LightningContext.Provider>,
    );
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();
  });
});
