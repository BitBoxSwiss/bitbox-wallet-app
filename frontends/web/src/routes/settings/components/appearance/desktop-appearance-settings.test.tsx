// SPDX-License-Identifier: Apache-2.0

import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useDesktopChrome } from '@/components/desktop-chrome/desktop-chrome';
import { useDarkmode } from '@/hooks/darkmode';
import { applyAppearance, readAppearance, saveAppearance, serializeAppearancePreset } from '@/utils/desktop-appearance';
import { saveDesktopAppearancePreset, setPreviewButtonStyle, setPreviewHeaderHeight, setPreviewLogoVisible, setNativeDecorations, setPreviewSeparateTitlebar } from '@/utils/desktop-chrome';
import { DesktopAppearanceSettings } from './desktop-appearance-settings';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/darkmode', () => ({ useDarkmode: vi.fn(() => ({ isDarkMode: false, toggleDarkmode: vi.fn() })) }));
vi.mock('@/hooks/mediaquery', () => ({ useMediaQuery: () => false }));
vi.mock('@/components/desktop-chrome/desktop-chrome', () => ({
  useDesktopChrome: vi.fn(() => ({ csd: true, nativeDecorations: false, activeNativeDecorations: false, previewSeparateTitlebar: false, previewHeaderHeight: 70, previewLogoVisible: true, previewButtonStyle: 'system' })),
}));
vi.mock('@/utils/desktop-chrome', () => ({ setPreviewHeaderHeight: vi.fn(), setPreviewLogoVisible: vi.fn(), setPreviewButtonStyle: vi.fn(), setNativeDecorations: vi.fn(), setPreviewSeparateTitlebar: vi.fn(), notifyChromeLayout: vi.fn(), saveDesktopAppearancePreset: vi.fn().mockResolvedValue('saved') }));

afterEach(() => {
  vi.mocked(useDesktopChrome).mockReset();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(saveDesktopAppearancePreset).mockResolvedValue('saved');
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: false, toggleDarkmode: vi.fn() });
  localStorage.clear();
  document.body.removeAttribute('style');
  document.body.removeAttribute('data-desktop-scroll-edge-effect');
});

const open = (group: string) => fireEvent.click(screen.getByRole('button', { name: group }));

// Color editing and reset work immediately with native borders, preserve the other theme, and keep header controls available.
it('edits and resets the current appearance independently of native window borders', () => {
  vi.mocked(useDesktopChrome).mockReturnValue({ ...useDesktopChrome()!, csd: false });
  saveAppearance('dark', { background: '#112233' });
  render(<DesktopAppearanceSettings />);
  open('desktopDesign.groups.palette');
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
  open('desktopDesign.groups.button');
  const radius = screen.getByLabelText('desktopDesign.fields.buttonRadius');
  fireEvent.change(radius, { target: { value: '100' } });
  expect(document.body.style.getPropertyValue('--design-button-radius')).toBe('100px');
  fireEvent.change(radius, { target: { value: '101' } });
  expect(readAppearance().light.buttonRadius).toBe(100);
  open('desktopDesign.groups.sidebar');
  const scale = screen.getByLabelText('desktopDesign.fields.logoScale');
  fireEvent.change(scale, { target: { value: '7' } });
  expect(scale).toHaveValue(7);
  expect(readAppearance().light.logoScale).toBeUndefined();
  fireEvent.change(scale, { target: { value: '75' } });
  expect(readAppearance().light.logoScale).toBe(75);
  fireEvent.change(scale, { target: { value: '' } });
  fireEvent.blur(scale);
  expect(scale).toHaveValue(75);
  const buttons = within(screen.getByRole('button', { name: 'desktopDesign.groups.button' }).parentElement!);
  fireEvent.click(buttons.getByRole('button', { name: 'desktopDesign.groups.gradients' }));
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.buttonGradientStrength'), { target: { value: '25' } });
  expect(document.body.style.getPropertyValue('--design-button-gradient')).toContain('25%');
});

// Caption previews and layout/shape settings apply live through their existing native and CSS contracts.
it('edits caption style, logo placement, sidebar width and switch shapes', () => {
  render(<DesktopAppearanceSettings />);
  open('desktopDesign.header');
  fireEvent.click(screen.getByRole('checkbox', { name: 'desktopChrome.previewSeparateTitlebar' }));
  expect(setPreviewSeparateTitlebar).toHaveBeenCalledWith(true);
  fireEvent.change(screen.getByLabelText('desktopChrome.previewButtonStyle'), { target: { value: 'windows' } });
  expect(setPreviewButtonStyle).toHaveBeenCalledWith('windows');
  open('desktopDesign.groups.sidebar');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.logoPosition'), { target: { value: 'below' } });
  expect(document.body).toHaveAttribute('data-desktop-logo-position', 'below');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.logoGap'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.sidebarWidth'), { target: { value: '320' } });
  expect(document.body.style.getPropertyValue('--design-logo-gap')).toBe('12px');
  expect(document.body.style.getPropertyValue('--design-sidebar-width')).toBe('320px');
  open('desktopDesign.groups.switch');
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
  open('desktopDesign.groups.palette');
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
  open('desktopDesign.groups.switch');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.switchRadius'), { target: { value: '12' } });
  open('desktopDesign.groups.scrollbars');
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.scrollbarHighlightOpacity'), { target: { value: '35' } });
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: true, toggleDarkmode: vi.fn() });
  rerender(<DesktopAppearanceSettings />);
  expect(screen.getByLabelText('desktopDesign.fields.switchRadius')).toHaveValue(12);
  expect(screen.getByLabelText('desktopDesign.fields.scrollbarHighlightOpacity')).toHaveValue(35);
  open('desktopDesign.groups.palette');
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
  expect(preview.queryByRole('checkbox', { name: 'desktopDesign.preview.disabledSwitch' })).not.toBeInTheDocument();
  expect(preview.getByText('desktopDesign.preview.secondaryText')).toBeInTheDocument();
  expect(preview.getByRole('combobox', { name: 'desktopDesign.preview.select' })).toBeInTheDocument();
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
  expect(setPreviewHeaderHeight).toHaveBeenCalledWith(70);
  expect(setNativeDecorations).toHaveBeenCalledWith(true);
  expect(setPreviewSeparateTitlebar).toHaveBeenCalledWith(false);
  expect(setPreviewLogoVisible).toHaveBeenCalledWith(true);
  expect(setPreviewButtonStyle).toHaveBeenCalledWith('system');
  expect(localStorage.getItem('unrelated-setting')).toBe('keep');
});

// Gradients belong to each element and are hidden until that element and its subsection are expanded.
it('nests gradients inside their corresponding element', () => {
  render(<DesktopAppearanceSettings />);
  expect(screen.queryByRole('button', { name: 'desktopDesign.groups.gradients' })).not.toBeInTheDocument();
  open('desktopDesign.groups.main');
  open('desktopDesign.groups.card');
  const cards = within(screen.getByRole('button', { name: 'desktopDesign.groups.card' }).parentElement!);
  fireEvent.click(cards.getByRole('button', { name: 'desktopDesign.groups.gradients' }));
  expect(cards.getByLabelText('desktopDesign.fields.cardGradientStrength')).toHaveValue(0);
  expect(screen.queryByLabelText('desktopDesign.fields.mainGradientStrength')).not.toBeInTheDocument();
  fireEvent.change(cards.getByLabelText('desktopDesign.fields.cardGradientStrength'), { target: { value: '30' } });
  expect(readAppearance().light.cardGradientStrength).toBe(30);
});

// Native borders keep the separate CSD row disabled until CSD is active, avoiding a misleading no-op setting.
it('disables the separate custom titlebar when system borders are active', () => {
  vi.mocked(useDesktopChrome).mockReturnValue({ ...useDesktopChrome()!, csd: false });
  render(<DesktopAppearanceSettings />);
  open('desktopDesign.header');
  expect(screen.getByRole('checkbox', { name: 'desktopChrome.previewSeparateTitlebar' })).toBeDisabled();
});

// Scrollbars start square and flush; optional inset and radius persist across themes and reset together.
it('defaults to unpadded square scrollbars with shared padding and rounding controls', () => {
  const { rerender } = render(<DesktopAppearanceSettings />);
  open('desktopDesign.groups.scrollbars');
  const padding = screen.getByLabelText('desktopDesign.fields.scrollbarPadding');
  const radius = screen.getByLabelText('desktopDesign.fields.scrollbarRadius');
  expect(padding).toHaveValue(0);
  expect(radius).toHaveValue(0);
  fireEvent.change(padding, { target: { value: '6' } });
  fireEvent.change(radius, { target: { value: '8' } });
  expect(document.body.style.getPropertyValue('--design-scrollbar-padding')).toBe('6px');
  expect(document.body.style.getPropertyValue('--design-scrollbar-radius')).toBe('8px');
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: true, toggleDarkmode: vi.fn() });
  rerender(<DesktopAppearanceSettings />);
  expect(padding).toHaveValue(6);
  expect(radius).toHaveValue(8);
  expect(readAppearance().dark).toMatchObject({ scrollbarPadding: 6, scrollbarRadius: 8 });
  fireEvent.click(screen.getByRole('button', { name: 'desktopDesign.resetAll' }));
  expect(padding).toHaveValue(0);
  expect(radius).toHaveValue(0);
  expect(document.body.style.getPropertyValue('--design-scrollbar-padding')).toBe('');
  expect(document.body.style.getPropertyValue('--design-scrollbar-radius')).toBe('');
});

// Edge treatment is off by default, shared across palettes, preserved by palette-only resets and cleared by full reset.
it('provides optional inset and fade treatments with no effect as the default', () => {
  const { rerender } = render(<DesktopAppearanceSettings />);
  open('desktopDesign.groups.effects');
  const effect = screen.getByLabelText('desktopDesign.fields.scrollEdgeEffect');
  expect(effect).toHaveValue('none');
  fireEvent.change(effect, { target: { value: 'inset' } });
  expect(document.body).toHaveAttribute('data-desktop-scroll-edge-effect', 'inset');
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: true, toggleDarkmode: vi.fn() });
  rerender(<DesktopAppearanceSettings />);
  expect(effect).toHaveValue('inset');
  fireEvent.change(effect, { target: { value: 'fade' } });
  expect(document.body).toHaveAttribute('data-desktop-scroll-edge-effect', 'fade');
  expect(readAppearance()).toEqual({ light: { scrollEdgeEffect: 'fade' }, dark: { scrollEdgeEffect: 'fade' } });
  fireEvent.click(screen.getByRole('button', { name: 'desktopDesign.reset' }));
  expect(effect).toHaveValue('fade');
  fireEvent.click(screen.getByRole('button', { name: 'desktopDesign.resetAll' }));
  expect(effect).toHaveValue('none');
  expect(document.body).toHaveAttribute('data-desktop-scroll-edge-effect', 'none');
  expect(readAppearance()).toEqual({ light: {}, dark: {} });
});

// Related controls follow the shared palette until explicitly overridden; removing the override restores inheritance.
it('shares accent colors with switches while allowing a separate switch color', () => {
  render(<DesktopAppearanceSettings />);
  open('desktopDesign.groups.palette');
  open('desktopDesign.groups.switch');
  const accent = screen.getByLabelText('desktopDesign.fields.accent');
  const track = screen.getByLabelText('desktopDesign.fields.switchColor');
  fireEvent.change(accent, { target: { value: '#123456' } });
  expect(track).toHaveValue('#123456');
  expect(document.body.style.getPropertyValue('--color-blue')).toBe('#123456');
  expect(document.body.style.getPropertyValue('--design-switch-color')).toBe('');
  fireEvent.change(track, { target: { value: '#abcdef' } });
  fireEvent.change(accent, { target: { value: '#654321' } });
  expect(track).toHaveValue('#abcdef');
  fireEvent.click(screen.getAllByRole('button', { name: 'desktopDesign.useShared' })[0]!);
  expect(track).toHaveValue('#654321');
  expect(readAppearance().light.switchColor).toBeUndefined();
});

// Strength applies to in-app card/button shadows and is shared across themes, independently of blur size.
it('edits card and button shadow strength independently', () => {
  saveAppearance('light', { shadowOpacity: 30 });
  const { rerender } = render(<DesktopAppearanceSettings />);
  open('desktopDesign.groups.card');
  open('desktopDesign.groups.button');
  expect(screen.getByLabelText('desktopDesign.fields.cardShadowOpacity')).toHaveValue(30);
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.cardShadowOpacity'), { target: { value: '65' } });
  fireEvent.change(screen.getByLabelText('desktopDesign.fields.buttonShadowOpacity'), { target: { value: '80' } });
  expect(document.body.style.getPropertyValue('--design-card-shadow-opacity')).toBe('65%');
  expect(document.body.style.getPropertyValue('--design-button-shadow-opacity')).toBe('80%');
  vi.mocked(useDarkmode).mockReturnValue({ isDarkMode: true, toggleDarkmode: vi.fn() });
  rerender(<DesktopAppearanceSettings />);
  expect(screen.getByLabelText('desktopDesign.fields.cardShadowOpacity')).toHaveValue(65);
  expect(screen.getByLabelText('desktopDesign.fields.buttonShadowOpacity')).toHaveValue(80);
  expect(setNativeDecorations).not.toHaveBeenCalled();
});

// Export includes both design palettes, handles cancellation/failure, and never exports wallet or window settings.
it('exports an in-app design preset through the native save dialog', async () => {
  saveAppearance('light', { accent: '#abcdef', cardShadow: 8 });
  saveAppearance('dark', { accent: '#123456', cardShadow: 8 });
  render(<DesktopAppearanceSettings />);
  const button = screen.getByRole('button', { name: 'desktopDesign.presets.export' });
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('desktopDesign.presets.saved'));
  const preset = JSON.parse(vi.mocked(saveDesktopAppearancePreset).mock.calls[0]![0]);
  expect(preset).toEqual({ format: 'bitbox-design', version: 1, profiles: readAppearance() });
  vi.mocked(saveDesktopAppearancePreset).mockResolvedValueOnce('cancelled');
  fireEvent.click(button);
  await waitFor(() => expect(button).not.toBeDisabled());
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  vi.mocked(saveDesktopAppearancePreset).mockRejectedValueOnce(new Error('failed'));
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('desktopDesign.presets.error'));
});

// Import persists both palettes before applying; bad files or denied storage preserve the current design and window settings.
it('imports validated design presets without changing window decorations', async () => {
  render(<DesktopAppearanceSettings />);
  const input = screen.getByLabelText('desktopDesign.presets.import');
  const upload = (text: string) => {
    const file = new File([text], 'design.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => text });
    fireEvent.change(input, { target: { files: [file] } });
  };
  const profiles = { light: { accent: '#abcdef', cardShadowOpacity: 60 }, dark: { accent: '#123456', cardShadowOpacity: 60 } };
  upload(serializeAppearancePreset(profiles));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('desktopDesign.presets.imported'));
  expect(readAppearance()).toEqual(profiles);
  expect(document.body.style.getPropertyValue('--color-blue')).toBe('#abcdef');
  upload('{broken');
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('desktopDesign.presets.invalid'));
  expect(readAppearance()).toEqual(profiles);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full');
  });
  upload(serializeAppearancePreset({ light: {}, dark: {} }));
  await waitFor(() => expect(screen.getAllByRole('alert').some(alert => alert.textContent?.includes('desktopDesign.saveFailed'))).toBe(true));
  expect(readAppearance()).toEqual(profiles);
  expect(document.body.style.getPropertyValue('--color-blue')).toBe('#abcdef');
  expect(setNativeDecorations).not.toHaveBeenCalled();
  expect(setPreviewButtonStyle).not.toHaveBeenCalled();
});
