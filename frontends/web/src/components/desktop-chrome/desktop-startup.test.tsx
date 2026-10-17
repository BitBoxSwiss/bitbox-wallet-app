// SPDX-License-Identifier: Apache-2.0

import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesktopStartup } from './desktop-startup';

const values = vi.hoisted(() => ({
  config: undefined as { frontend: { darkmode?: boolean } } | undefined,
  state: { csd: true, systemAppearanceReady: true, systemDark: false },
  dark: false,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/ConfigProvider', () => ({ useConfig: () => ({ config: values.config }) }));
vi.mock('@/hooks/darkmode', () => ({ useDarkmode: () => ({ isDarkMode: values.dark }) }));
vi.mock('@/utils/env', () => ({ runningInQtWebEngine: () => true }));
vi.mock('./desktop-chrome', () => ({ useDesktopChrome: () => values.state }));

beforeEach(() => {
  values.config = { frontend: {} };
  values.state = { csd: true, systemAppearanceReady: true, systemDark: false };
  values.dark = false;
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Linux QtWebEngine');
});
afterEach(() => vi.restoreAllMocks());

// The web loading view needs theme readiness, rather than a native paint acknowledgement or forced redraw.
it('shows the app as soon as its selected theme is ready', () => {
  render(<DesktopStartup><p>App content</p></DesktopStartup>);
  expect(screen.getByText('App content')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

// A late config/portal result must not flash the app in the wrong theme.
it('waits for config and the selected theme before revealing the app', () => {
  values.config = undefined;
  const { rerender } = render(<DesktopStartup><p>App content</p></DesktopStartup>);
  expect(screen.getByRole('status')).toBeInTheDocument();
  values.config = { frontend: { darkmode: true } };
  rerender(<DesktopStartup><p>App content</p></DesktopStartup>);
  expect(screen.getByRole('status')).toBeInTheDocument();
  values.dark = true;
  rerender(<DesktopStartup><p>App content</p></DesktopStartup>);
  expect(screen.getByText('App content')).toBeInTheDocument();
});

// Live theme changes must not remount the app and discard in-progress form state.
it('keeps the app mounted after startup when the selected theme changes', () => {
  const { rerender } = render(<DesktopStartup><p>App content</p></DesktopStartup>);
  const content = screen.getByText('App content');
  values.config = { frontend: { darkmode: true } };
  rerender(<DesktopStartup><p>App content</p></DesktopStartup>);
  expect(screen.getByText('App content')).toBe(content);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

// Native window borders retain their ordinary startup path, independently of the CSD readiness view.
it('does not gate the native-border mode on CSD readiness', () => {
  values.state.csd = false;
  values.config = undefined;
  render(<DesktopStartup><p>App content</p></DesktopStartup>);
  expect(screen.getByText('App content')).toBeInTheDocument();
});
