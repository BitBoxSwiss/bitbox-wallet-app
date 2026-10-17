// SPDX-License-Identifier: Apache-2.0

import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useDarkmode } from '@/hooks/darkmode';
import { applyAppearance, readAppearance, saveAppearance } from '@/utils/desktop-appearance';
import { setPreviewButtonStyle, setPreviewHeaderHeight, setPreviewLogoVisible } from '@/utils/desktop-chrome';
import { DesktopAppearanceSettings } from './desktop-appearance-settings';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/darkmode', () => ({ useDarkmode: vi.fn(() => ({ isDarkMode: false, toggleDarkmode: vi.fn() })) }));
vi.mock('@/hooks/mediaquery', () => ({ useMediaQuery: () => false }));
vi.mock('@/components/desktop-chrome/desktop-chrome', () => ({
  useDesktopChrome: () => ({ csd: false, previewHeaderHeight: 70, previewLogoVisible: true, previewButtonStyle: 'system' }),
}));
vi.mock('@/utils/desktop-chrome', () => ({ setPreviewHeaderHeight: vi.fn(), setPreviewLogoVisible: vi.fn(), setPreviewButtonStyle: vi.fn(), setNativeDecorations: vi.fn(), notifyChromeLayout: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: false, toggleDarkmode: vi.fn() });
  localStorage.clear();
  document.body.removeAttribute('style');
});

const open = (group: string) => fireEvent.click(screen.getByRole('button', { name: group }));

// Color editing and reset work immediately with native borders, preserve the other theme, and keep header controls available.
it('edits and resets the current appearance independently of native window borders', () => {
  saveAppearance('dark', { background: '#112233' });
  render(<DesktopAppearanceSettings />);
  open('desktopDesign.groups.colors');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.background'), { target: { value: '#abcdef' } });
  expect(document.body.style.getPropertyValue('--background')).toBe('#abcdef');
  expect(readAppearance().light.background).toBe('#abcdef');
  open('desktopDesign.header');
  fireEvent.change(screen.getByLabelText('desktopChrome.previewHeaderHeight'), { target: { value: '48' } });
  expect(setPreviewHeaderHeight).toHaveBeenCalledWith(48);
  expect(screen.getByRole('checkbox', { name: 'desktopChrome.previewLogo' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'desktopDesign.reset' }));
  expect(document.body.style.getPropertyValue('--background')).toBe('');
  expect(readAppearance()).toEqual({ light: {}, dark: { background: '#112233' } });
});

// Button shapes and gradients reject invalid numbers while allowing partially typed values until the field loses focus.
it('supports button shapes and gradients with numeric limits', () => {
  render(<DesktopAppearanceSettings />);
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
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.logoPosition'), { target: { value: 'centered' } });
  expect(document.body).toHaveAttribute('data-desktop-logo-position', 'centered');
  expect(readAppearance().light.logoPosition).toBe('centered');
});

// The theme shown by the app determines which profile receives changes, while storage failures remain visible to the user.
it('edits the dark profile and reports a persistence failure', () => {
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: true, toggleDarkmode: vi.fn() });
  render(<DesktopAppearanceSettings />);
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

// Theme changes keep shared settings in the mounted UI and on disk; palette reset preserves them.
it('keeps shapes and scrollbar highlights global while editing separate palettes', () => {
  saveAppearance('light', { background: '#abcdef' });
  const { rerender } = render(<DesktopAppearanceSettings />);
  open('desktopDesign.groups.shapes');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.switchRadius'), { target: { value: '12' } });
  open('desktopDesign.groups.scrollbars');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.scrollbarHighlightOpacity'), { target: { value: '35' } });
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: true, toggleDarkmode: vi.fn() });
  rerender(<DesktopAppearanceSettings />);
  expect(screen.getByLabelText('desktopDesign.fields.switchRadius')).toHaveValue(12);
  expect(screen.getByLabelText('desktopDesign.fields.scrollbarHighlightOpacity')).toHaveValue(35);
  open('desktopDesign.groups.colors');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.background'), { target: { value: '#123456' } });
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: false, toggleDarkmode: vi.fn() });
  rerender(<DesktopAppearanceSettings />);
  expect(screen.getByLabelText('desktopDesign.fields.background')).toHaveValue('#abcdef');
  fireEvent.click(screen.getByRole('button', { name: 'desktopDesign.reset' }));
  expect(readAppearance()).toEqual({
    light: { switchRadius: 12, scrollbarHighlightOpacity: 35 },
    dark: { background: '#123456', switchRadius: 12, scrollbarHighlightOpacity: 35 },
  });
});

// Sample controls use the real components while keeping all interactions isolated from saved preferences.
it('provides interactive component samples without changing app preferences', () => {
  render(<DesktopAppearanceSettings />);
  const preview = within(screen.getByRole('region', { name: 'desktopDesign.preview.title' }));
  const toggle = preview.getByRole('checkbox', { name: 'desktopDesign.preview.switch' });
  expect(toggle).toBeChecked();
  fireEvent.click(preview.getByRole('button', { name: 'desktopDesign.preview.primary' }));
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  expect(toggle).toBeChecked();
  fireEvent.change(preview.getByLabelText('desktopDesign.preview.input'), { target: { value: 'Sample' } });
  expect(preview.getByRole('button', { name: 'desktopDesign.preview.disabled' })).toBeDisabled();
  expect(preview.getByRole('checkbox', { name: 'desktopDesign.preview.disabledSwitch' })).toBeDisabled();
  expect(localStorage.length).toBe(0);
});

// A full reset clears both theme profiles and shared chrome choices while retaining unrelated storage.
it('resets all playground defaults including centered logo placement and shared chrome settings', () => {
  localStorage.setItem('unrelated-setting', 'keep');
  saveAppearance('light', { logoPosition: 'centered', logoGap: 16, switchRadius: 12 });
  saveAppearance('dark', { sidebarWidth: 400 });
  applyAppearance(readAppearance().light, 'light');
  render(<DesktopAppearanceSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'desktopDesign.resetAll' }));
  expect(readAppearance()).toEqual({ light: {}, dark: {} });
  expect(document.body.style.getPropertyValue('--design-switch-radius')).toBe('');
  expect(document.body).toHaveAttribute('data-desktop-logo-position', 'beside');
  expect(setPreviewHeaderHeight).toHaveBeenCalledWith(48);
  expect(setPreviewLogoVisible).toHaveBeenCalledWith(true);
  expect(setPreviewButtonStyle).toHaveBeenCalledWith('system');
  expect(localStorage.getItem('unrelated-setting')).toBe('keep');
});
