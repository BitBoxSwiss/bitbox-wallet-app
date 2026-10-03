// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getConfig, setConfig, type TBreezSDKLogLevel, type TConfig } from '@/api/config';
import { ConfigProvider } from '@/contexts/ConfigProvider';
import { useMediaQuery } from '@/hooks/mediaquery';
import en from '@/locales/en/app.json';
import { LightningLogLevelSetting } from './lightning-log-level-setting';

vi.mock('@/api/config', () => ({ getConfig: vi.fn(), setConfig: vi.fn() }));
vi.mock('@/hooks/mediaquery', () => ({ useMediaQuery: vi.fn(() => false) }));
vi.mock('@/hooks/backbutton', () => ({ UseBackButton: () => null }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key.split('.').reduce((value: any, part) => value?.[part], en) ?? key,
  }),
}));

const config = { backend: { breezSDKLogLevel: 'warn' }, frontend: {} } as TConfig;

const renderSetting = () => render(<LightningLogLevelSetting />, { wrapper: ConfigProvider });

describe('LightningLogLevelSetting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useMediaQuery).mockReturnValue(false);
    vi.mocked(getConfig).mockResolvedValue(config);
    vi.mocked(setConfig).mockImplementation(async nextConfig => {
      vi.mocked(getConfig).mockResolvedValue(nextConfig);
    });
  });

  it('waits for config before showing the selector', () => {
    vi.mocked(getConfig).mockReturnValue(new Promise(() => {}));
    renderSetting();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Log warnings')).not.toBeInTheDocument();
  });

  it('shows the saved level without a restart banner initially', async () => {
    renderSetting();
    expect(await screen.findByRole('combobox', { name: 'Log level' })).toBeEnabled();
    expect(screen.getByText('Log warnings')).toBeInTheDocument();
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();
  });

  it.each<[string, TBreezSDKLogLevel]>([
    ['Log errors', 'error'],
    ['Log warnings', 'warn'],
    ['Debug', 'debug'],
    ['Trace', 'trace'],
  ])('saves %s through the shared config flow', async (label, value) => {
    vi.mocked(getConfig).mockResolvedValue({
      ...config,
      backend: { ...config.backend, breezSDKLogLevel: value === 'warn' ? 'error' : 'warn' },
    });
    const user = userEvent.setup();
    renderSetting();
    await user.click(await screen.findByRole('combobox', { name: 'Log level' }));
    await user.click(screen.getByRole('option', { name: label }));
    expect(setConfig).toHaveBeenCalledWith({
      ...config,
      backend: { ...config.backend, breezSDKLogLevel: value },
    });
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();
  });

  it('shows the restart banner only after the change is saved', async () => {
    let finishSave!: () => void;
    vi.mocked(setConfig).mockImplementationOnce(() => new Promise<void>(resolve => {
      finishSave = resolve;
    }));
    const user = userEvent.setup();
    renderSetting();
    await user.click(await screen.findByRole('combobox', { name: 'Log level' }));
    await user.click(screen.getByRole('option', { name: 'Debug' }));
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();

    await act(async () => finishSave());
    expect(screen.getByText(en.settings.restart)).toBeInTheDocument();
  });

  it('does not request a restart when selecting the saved level', async () => {
    const user = userEvent.setup();
    renderSetting();
    await user.click(await screen.findByRole('combobox', { name: 'Log level' }));
    await user.click(screen.getByRole('option', { name: 'Log warnings' }));
    expect(setConfig).not.toHaveBeenCalled();
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();
  });

  it('opens the mobile selector from the row and closes it after selection', async () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    const user = userEvent.setup();
    renderSetting();
    await user.click(await screen.findByText('Log level'));
    await user.click(screen.getByRole('button', { name: 'Trace' }));
    expect(setConfig).toHaveBeenCalledWith({
      ...config,
      backend: { ...config.backend, breezSDKLogLevel: 'trace' },
    });
    expect(screen.queryByRole('button', { name: 'Trace' })).not.toBeInTheDocument();
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();
  });

  it('keeps the restart banner after leaving settings and clears it when the level is restored', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSetting();
    await user.click(await screen.findByRole('combobox', { name: 'Log level' }));
    await user.click(screen.getByRole('option', { name: 'Debug' }));
    expect(await screen.findByText(en.settings.restart)).toBeInTheDocument();

    rerender(<></>);
    rerender(<LightningLogLevelSetting />);
    expect(screen.getByText('Debug')).toBeInTheDocument();
    expect(screen.getByText(en.settings.restart)).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Log level' }));
    await user.click(screen.getByRole('option', { name: 'Log warnings' }));
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();

    rerender(<></>);
    rerender(<LightningLogLevelSetting />);
    expect(screen.queryByText(en.settings.restart)).not.toBeInTheDocument();
  });

  it('keeps the restart banner when saving finishes after leaving settings', async () => {
    let finishSave!: () => void;
    vi.mocked(setConfig).mockImplementationOnce(() => new Promise<void>(resolve => {
      finishSave = resolve;
    }));
    const user = userEvent.setup();
    const { rerender } = renderSetting();
    await user.click(await screen.findByRole('combobox', { name: 'Log level' }));
    await user.click(screen.getByRole('option', { name: 'Debug' }));
    rerender(<></>);

    await act(async () => finishSave());
    rerender(<LightningLogLevelSetting />);
    expect(screen.getByText('Debug')).toBeInTheDocument();
    expect(screen.getByText(en.settings.restart)).toBeInTheDocument();
  });
});
