// SPDX-License-Identifier: Apache-2.0

import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useDarkmode } from '@/hooks/darkmode';
import { readAppearance, saveAppearance } from '@/utils/desktop-appearance';
import { setPreviewButtonStyle, setPreviewHeaderHeight } from '@/utils/desktop-chrome';
import { DesktopAppearanceSettings } from './desktop-appearance-settings';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/darkmode', () => ({ useDarkmode: vi.fn(() => ({ isDarkMode: false, toggleDarkmode: vi.fn() })) }));
vi.mock('@/hooks/mediaquery', () => ({ useMediaQuery: () => false }));
vi.mock('@/components/desktop-chrome/desktop-chrome', () => ({
  useDesktopChrome: () => ({ csd: false, previewHeaderHeight: 70, previewLogoVisible: true, previewButtonStyle: 'system' }),
}));
vi.mock('@/utils/desktop-chrome', () => ({ setPreviewHeaderHeight: vi.fn(), setPreviewLogoVisible: vi.fn(), setPreviewButtonStyle: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: false, toggleDarkmode: vi.fn() });
  localStorage.clear();
  document.body.removeAttribute('style');
});

const open = (group: string) => fireEvent.click(screen.getByRole('button', { name: group }));

// Color editing and reset work immediately with native borders, preserve the other theme, and keep header controls available.
it('edits and resets the current appearance independently of native window borders', () => {
  saveAppearance('dark', { background: '#112233' });
  render(<DesktopAppearanceSettings />);
  open('desktopDesign.title');
  open('desktopDesign.groups.colors');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.background'), { target: { value: '#abcdef' } });
  expect(document.body.style.getPropertyValue('--background')).toBe('#abcdef');
  expect(readAppearance().light.background).toBe('#abcdef');
  open('desktopDesign.header');
  fireEvent.change(screen.getByLabelText('desktopChrome.previewHeaderHeight'), { target: { value: '48' } });
  expect(setPreviewHeaderHeight).toHaveBeenCalledWith(48);
  expect(screen.getByRole('checkbox')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'desktopDesign.reset' }));
  expect(document.body.style.getPropertyValue('--background')).toBe('');
  expect(readAppearance()).toEqual({ light: {}, dark: { background: '#112233' } });
});

// Button shapes and gradients reject invalid numbers while allowing partially typed values until the field loses focus.
it('supports button shapes and gradients with numeric limits', () => {
  render(<DesktopAppearanceSettings />);
  open('desktopDesign.title');
  open('desktopDesign.groups.shapes');
  const radius = screen.getByLabelText('desktopDesign.fields.buttonRadius');
  fireEvent.change(radius, { target: { value: '100' } });
  expect(document.body.style.getPropertyValue('--design-button-radius')).toBe('100px');
  fireEvent.change(radius, { target: { value: '101' } });
  expect(readAppearance().light.buttonRadius).toBe(100);
  const scale = screen.getByLabelText('desktopDesign.fields.logoScale');
  fireEvent.change(scale, { target: { value: '7' } });
  expect(scale).toHaveValue(7);
  expect(readAppearance().light.logoScale).toBeUndefined();
  fireEvent.change(scale, { target: { value: '75' } });
  expect(readAppearance().light.logoScale).toBe(75);
  fireEvent.change(scale, { target: { value: '' } });
  fireEvent.blur(scale);
  expect(scale).toHaveValue(75);
  open('desktopDesign.groups.gradients');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.buttonGradientStrength'), { target: { value: '25' } });
  expect(document.body.style.getPropertyValue('--design-button-gradient')).toContain('25%');
});

// Caption previews and layout/shape settings apply live through their existing native and CSS contracts.
it('edits caption style, logo placement, sidebar width and switch shapes', () => {
  render(<DesktopAppearanceSettings />);
  open('desktopDesign.title');
  open('desktopDesign.header');
  fireEvent.change(screen.getByLabelText('desktopChrome.previewButtonStyle'), { target: { value: 'windows' } });
  expect(setPreviewButtonStyle).toHaveBeenCalledWith('windows');
  open('desktopDesign.groups.layout');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.logoPosition'), { target: { value: 'below' } });
  expect(document.body).toHaveAttribute('data-desktop-logo-position', 'below');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.logoGap'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.sidebarWidth'), { target: { value: '320' } });
  expect(document.body.style.getPropertyValue('--design-logo-gap')).toBe('12px');
  expect(document.body.style.getPropertyValue('--design-sidebar-width')).toBe('320px');
  open('desktopDesign.groups.shapes');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.switchRadius'), { target: { value: '14' } });
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.switchThumbRadius'), { target: { value: '8' } });
  expect(readAppearance().light).toMatchObject({ logoPosition: 'below', logoGap: 12, sidebarWidth: 320, switchRadius: 14, switchThumbRadius: 8 });
  saveAppearance('light', { ...readAppearance().light, sidebarWidth: 360 });
  fireEvent(window, new Event('bitbox-appearance-saved'));
  expect(screen.getByLabelText('desktopDesign.fields.sidebarWidth')).toHaveValue(360);
});

// The theme shown by the app determines which profile receives changes, while storage failures remain visible to the user.
it('edits the dark profile and reports a persistence failure', () => {
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: true, toggleDarkmode: vi.fn() });
  render(<DesktopAppearanceSettings />);
  open('desktopDesign.title');
  open('desktopDesign.groups.colors');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.background'), { target: { value: '#123456' } });
  expect(readAppearance().dark.background).toBe('#123456');
  expect(readAppearance().light).toEqual({});
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full');
  });
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.background'), { target: { value: '#abcdef' } });
  expect(document.body.style.getPropertyValue('--background')).toBe('#abcdef');
  expect(screen.getByRole('alert')).toHaveTextContent('desktopDesign.saveFailed');
});
