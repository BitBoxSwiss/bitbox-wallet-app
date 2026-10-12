// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errUserAbort, setDeviceLanguage } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { useMediaQuery } from '@/hooks/mediaquery';
import { DeviceLanguageSetting } from './device-language-setting';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/api/bitbox02', () => ({
  errUserAbort: 104,
  setDeviceLanguage: vi.fn(),
}));

vi.mock('@/components/alert/Alert', () => ({ alertUser: vi.fn() }));
vi.mock('@/hooks/mediaquery', () => ({ useMediaQuery: vi.fn() }));

const renderSetting = (language = 'en', supportedLanguages = ['en', 'de', 'it', 'es']) => render(
  <BackButtonProvider>
    <DeviceLanguageSetting deviceID="device-1" language={language} supportedLanguages={supportedLanguages} />
  </BackButtonProvider>
);

describe('DeviceLanguageSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMediaQuery).mockReturnValue(false);
    vi.mocked(setDeviceLanguage).mockResolvedValue({ success: true });
  });

  it('shows the current language and offers the languages reported by the device', async () => {
    const user = userEvent.setup();
    renderSetting('de');

    expect(screen.getByText('Deutsch')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'English', 'Deutsch', 'Italiano', 'Español',
    ]);
    await user.click(screen.getByRole('option', { name: 'English' }));

    expect(setDeviceLanguage).toHaveBeenCalledWith('device-1', 'en');
    await waitFor(() => expect(screen.getByText('English')).toBeInTheDocument());
  });

  it.each([
    { code: 'es', label: 'Español' },
    { code: 'it', label: 'Italiano' },
    { code: 'sw', label: 'sw' },
  ])('can select a reported language ($code) without offering unsupported languages', async ({ code, label }) => {
    const user = userEvent.setup();
    renderSetting('en', ['en', code]);

    await user.click(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['English', label]);
    await user.click(screen.getByRole('option', { name: label }));

    expect(setDeviceLanguage).toHaveBeenCalledWith('device-1', code);
    await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument());
  });

  it('keeps the previous selection until confirmation on the device succeeds', async () => {
    const user = userEvent.setup();
    const result = Promise.withResolvers<{ success: true }>();
    vi.mocked(setDeviceLanguage).mockReturnValue(result.promise);
    renderSetting();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Deutsch' }));

    expect(setDeviceLanguage).toHaveBeenCalledWith('device-1', 'de');
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { hidden: true })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'deviceSettings.deviceLanguage.title' })).toBeInTheDocument();
    expect(screen.getByText('bitbox02Interact.followInstructions')).toBeInTheDocument();
    expect(alertUser).not.toHaveBeenCalled();

    await act(async () => result.resolve({ success: true }));
    expect(screen.getByText('Deutsch')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeEnabled();
    expect(screen.queryByText('bitbox02Interact.followInstructions')).not.toBeInTheDocument();
    expect(alertUser).toHaveBeenCalledWith('deviceSettings.deviceLanguage.success');
  });

  it.each([errUserAbort, 101])('keeps the selection when the device returns error %s', async code => {
    const user = userEvent.setup();
    vi.mocked(setDeviceLanguage).mockResolvedValue({ success: false, code, message: 'device error' });
    renderSetting();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Deutsch' }));

    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.queryByText('bitbox02Interact.followInstructions')).not.toBeInTheDocument();
    if (code === errUserAbort) {
      expect(alertUser).toHaveBeenCalledWith('deviceSettings.deviceLanguage.error_104');
    } else {
      expect(alertUser).toHaveBeenCalledWith('device error');
    }
  });

  it('recovers from a failed request without changing the selection', async () => {
    const user = userEvent.setup();
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(setDeviceLanguage).mockRejectedValue(new Error('disconnected'));
    renderSetting();

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Deutsch' }));

    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(alertUser).toHaveBeenCalledWith('genericError');
    logError.mockRestore();
  });

  it('uses the fullscreen language selector on mobile', async () => {
    const user = userEvent.setup();
    vi.mocked(useMediaQuery).mockReturnValue(true);
    renderSetting('en', ['en', 'it']);

    await user.click(screen.getByText('deviceSettings.deviceLanguage.title'));
    await user.click(screen.getByRole('button', { name: 'Italiano' }));

    expect(setDeviceLanguage).toHaveBeenCalledWith('device-1', 'it');
    await waitFor(() => expect(screen.getByText('Italiano')).toBeInTheDocument());
  });
});
