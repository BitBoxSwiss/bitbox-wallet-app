// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { DarkModeProvider } from './DarkmodeProvider';
import { useConfig } from './ConfigProvider';
import { useDarkmode } from '@/hooks/darkmode';
import { useDesktopSystemDark } from '@/components/desktop-chrome/desktop-chrome';
import { useMediaQuery } from '@/hooks/mediaquery';
import { detectDarkTheme, setDarkTheme } from '@/api/darktheme';
import { runningInAndroid } from '@/utils/env';
import type { TConfig } from '@/api/config';

vi.mock('./ConfigProvider', () => ({ useConfig: vi.fn() }));
vi.mock('@/components/desktop-chrome/desktop-chrome', () => ({ useDesktopSystemDark: vi.fn() }));
vi.mock('@/hooks/mediaquery', () => ({ useMediaQuery: vi.fn() }));
vi.mock('@/api/darktheme', () => ({ detectDarkTheme: vi.fn(), setDarkTheme: vi.fn() }));
vi.mock('@/utils/env', () => ({ runningInAndroid: vi.fn() }));

const Theme = () => {
  const { isDarkMode, toggleDarkmode } = useDarkmode();
  return <button onClick={() => toggleDarkmode(false)}>{isDarkMode ? 'dark' : 'light'}</button>;
};
const portal = (systemDark: boolean) => vi.mocked(useDesktopSystemDark).mockReturnValue(systemDark);
const config = (darkmode?: boolean) => vi.mocked(useConfig).mockReturnValue({
  config: { frontend: { darkmode } } as TConfig,
  setConfig: vi.fn(),
});

beforeEach(() => {
  config();
  vi.mocked(runningInAndroid).mockReturnValue(false);
  vi.mocked(useMediaQuery).mockReturnValue(false);
  vi.mocked(detectDarkTheme).mockResolvedValue(false);
  vi.mocked(setDarkTheme).mockResolvedValue({ success: true });
});
afterEach(() => {
  vi.resetAllMocks();
  document.body.classList.remove('dark-mode', 'light-mode');
});

describe('system appearance', () => {
  it('follows live Linux portal changes when no app override is saved', async () => {
    portal(true);
    const { rerender } = render(<DarkModeProvider><Theme /></DarkModeProvider>);
    await screen.findByText('dark');
    portal(false);
    rerender(<DarkModeProvider><Theme /></DarkModeProvider>);
    await screen.findByText('light');
    expect(document.body).toHaveClass('light-mode');
    expect(detectDarkTheme).not.toHaveBeenCalled();
  });

  it('preserves an explicit app preference across system changes', async () => {
    config(false);
    portal(true);
    const { rerender } = render(<DarkModeProvider><Theme /></DarkModeProvider>);
    expect(screen.getByText('light')).toBeInTheDocument();
    portal(false);
    rerender(<DarkModeProvider><Theme /></DarkModeProvider>);
    portal(true);
    rerender(<DarkModeProvider><Theme /></DarkModeProvider>);
    expect(screen.getByText('light')).toBeInTheDocument();
    expect(detectDarkTheme).not.toHaveBeenCalled();
  });

  it('discards a pending legacy result after the portal becomes available', async () => {
    let finish!: (dark: boolean) => void;
    vi.mocked(detectDarkTheme).mockReturnValue(new Promise(resolve => {
      finish = resolve;
    }));
    const { rerender } = render(<DarkModeProvider><Theme /></DarkModeProvider>);
    portal(true);
    rerender(<DarkModeProvider><Theme /></DarkModeProvider>);
    await screen.findByText('dark');
    await act(async () => finish(false));
    expect(screen.getByText('dark')).toBeInTheDocument();
  });

  it('keeps existing desktop detection when no portal state is supplied', async () => {
    vi.mocked(detectDarkTheme).mockResolvedValue(true);
    render(<DarkModeProvider><Theme /></DarkModeProvider>);
    await screen.findByText('dark');
    expect(detectDarkTheme).toHaveBeenCalledOnce();
  });

  it('keeps Android media query detection', async () => {
    vi.mocked(runningInAndroid).mockReturnValue(true);
    vi.mocked(useMediaQuery).mockReturnValue(true);
    render(<DarkModeProvider><Theme /></DarkModeProvider>);
    await screen.findByText('dark');
    await waitFor(() => expect(setDarkTheme).toHaveBeenLastCalledWith(true));
    expect(detectDarkTheme).not.toHaveBeenCalled();
  });
});
