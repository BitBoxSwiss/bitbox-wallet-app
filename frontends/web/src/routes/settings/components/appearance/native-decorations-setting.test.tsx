// SPDX-License-Identifier: Apache-2.0
import { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NativeDecorationsSetting } from './native-decorations-setting';
import { useDesktopChrome } from '@/components/desktop-chrome/desktop-chrome';
import { setNativeDecorations, TDesktopChromeState } from '@/utils/desktop-chrome';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/desktop-chrome/desktop-chrome', () => ({ useDesktopChrome: vi.fn() }));
vi.mock('@/utils/desktop-chrome', () => ({ setNativeDecorations: vi.fn() }));
vi.mock('@/hooks/mediaquery', () => ({ useMediaQuery: () => false }));
vi.mock('@/components/dialog/dialog', () => ({
  Dialog: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) => open ? <div role="alertdialog">{title}{children}</div> : null,
  DialogButtons: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
afterEach(() => vi.resetAllMocks());

it('hides native decorations outside a desktop shell', () => {
  vi.mocked(useDesktopChrome).mockReturnValue(undefined);
  render(<NativeDecorationsSetting />);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

it.each([false, true])('keeps the desktop testing option available with native decorations %s', nativeDecorations => {
  vi.mocked(useDesktopChrome).mockReturnValue({
    nativeDecorations, activeNativeDecorations: nativeDecorations, csd: !nativeDecorations,
  } as TDesktopChromeState);
  render(<NativeDecorationsSetting />);
  const checkbox = screen.getByRole('checkbox');
  expect((checkbox as HTMLInputElement).checked).toBe(nativeDecorations);
  fireEvent.click(checkbox);
  expect(setNativeDecorations).toHaveBeenCalledWith(!nativeDecorations);
  expect(screen.getByRole('alertdialog')).toHaveTextContent('settings.restart');
});
