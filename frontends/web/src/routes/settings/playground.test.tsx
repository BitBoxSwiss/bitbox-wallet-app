// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useDesktopModernized } from '@/components/desktop-chrome/desktop-chrome';
import { runningInQtWebEngine } from '@/utils/env';
import { Playground } from './playground';
import { Tabs } from './components/tabs';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/desktop-chrome/desktop-chrome', () => ({ useDesktopModernized: vi.fn(() => true) }));
vi.mock('@/utils/env', () => ({ runningInQtWebEngine: vi.fn(() => true) }));
vi.mock('@/contexts/app-state-context', () => ({ useAppState: () => ({ deviceIDs: [], devices: {}, hasAccounts: false }) }));
vi.mock('@/hooks/darkmode', () => ({ useDarkmode: () => ({ isDarkMode: false }) }));
vi.mock('@/hooks/mediaquery', () => ({ useMediaQuery: () => false }));
vi.mock('@/components/layout', () => ({
  Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Header: () => null,
}));
vi.mock('@/components/view/view', () => ({
  View: ({ children }: { children: ReactNode }) => <>{children}</>,
  ViewContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('./components/tabs', async importOriginal => ({
  ...await importOriginal<typeof import('./components/tabs')>(),
  WithSettingsTabs: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('./components/appearance/desktop-appearance-settings', () => ({ DesktopAppearanceSettings: () => <p>Playground controls</p> }));

afterEach(() => vi.clearAllMocks());

// The experimental tab belongs to desktop Settings; mobile and browser navigation keep their existing tabs.
it('shows the Playground tab only when the desktop contract is available', () => {
  const { rerender } = render(<MemoryRouter><Tabs hideMobileMenu /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'desktopDesign.tab' })).toHaveAttribute('href', '/settings/playground');
  vi.mocked(useDesktopModernized).mockReturnValue(false);
  rerender(<MemoryRouter><Tabs hideMobileMenu /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: 'desktopDesign.tab' })).not.toBeInTheDocument();
});

// Direct browser URLs return to General, while Qt waits for initialization before rendering its standalone playground.
it('guards the route and waits for the desktop bridge', () => {
  const view = () => (
    <MemoryRouter initialEntries={['/settings/playground']}><Routes>
      <Route path="/settings/playground" element={<Playground />} />
      <Route path="/settings/general" element={<p>General settings</p>} />
    </Routes></MemoryRouter>
  );
  vi.mocked(runningInQtWebEngine).mockReturnValue(false);
  const browser = render(view());
  expect(screen.getByText('General settings')).toBeInTheDocument();
  browser.unmount();
  vi.mocked(runningInQtWebEngine).mockReturnValue(true);
  vi.mocked(useDesktopModernized).mockReturnValue(false);
  const desktop = render(view());
  expect(screen.queryByText('Playground controls')).not.toBeInTheDocument();
  vi.mocked(useDesktopModernized).mockReturnValue(true);
  desktop.rerender(view());
  expect(screen.getByText('Playground controls')).toBeInTheDocument();
});
