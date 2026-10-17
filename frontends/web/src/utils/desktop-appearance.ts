// SPDX-License-Identifier: Apache-2.0

export type TAppearance = Record<string, string | number>;
export type TAppearanceMode = 'light' | 'dark';
type TField = {
  id: string;
  group: string;
  property: string;
  defaults: [string, string] | [number, number];
} & ({ type: 'color' } | { type: 'number'; min: number; max: number; unit: string; step?: number });

export const gradientTargets = ['main', 'sidebar', 'guide', 'button', 'card'] as const;
export const appearanceFields: TField[] = [
  { id: 'background', group: 'colors', type: 'color', property: '--background', defaults: ['#f5f5f5', '#1d1d1b'] },
  { id: 'surface', group: 'colors', type: 'color', property: '--background-secondary', defaults: ['#ffffff', '#333333'] },
  { id: 'text', group: 'colors', type: 'color', property: '--color-default', defaults: ['#1d1d1b', '#f5f5f5'] },
  { id: 'mutedText', group: 'colors', type: 'color', property: '--color-secondary', defaults: ['#777777', '#999999'] },
  { id: 'accent', group: 'colors', type: 'color', property: '--color-blue', defaults: ['#5e94bf', '#5e94bf'] },
  { id: 'accentHover', group: 'colors', type: 'color', property: '--color-lightblue', defaults: ['#73a5cd', '#73a5cd'] },
  { id: 'sidebar', group: 'colors', type: 'color', property: '--background-dark', defaults: ['#333333', '#333333'] },
  { id: 'sidebarText', group: 'colors', type: 'color', property: '--design-sidebar-text', defaults: ['#ffffff', '#ffffff'] },
  { id: 'guide', group: 'colors', type: 'color', property: '--design-guide-background', defaults: ['#73a5cd', '#73a5cd'] },
  { id: 'guideHeader', group: 'colors', type: 'color', property: '--design-guide-header', defaults: ['#5e94bf', '#5e94bf'] },
  { id: 'guideText', group: 'colors', type: 'color', property: '--design-guide-text', defaults: ['#ffffff', '#ffffff'] },
  { id: 'buttonText', group: 'colors', type: 'color', property: '--design-button-text', defaults: ['#ffffff', '#ffffff'] },
  { id: 'focus', group: 'colors', type: 'color', property: '--design-focus', defaults: ['#2684ff', '#2684ff'] },
  { id: 'borderColor', group: 'effects', type: 'color', property: '--design-border-color', defaults: ['#000000', '#ffffff'] },
  { id: 'borderWidth', group: 'effects', type: 'number', property: '--design-border-width', defaults: [1, 1], min: 0, max: 4, unit: 'px' },
  { id: 'borderOpacity', group: 'effects', type: 'number', property: '--design-border-opacity', defaults: [0, 0], min: 0, max: 100, unit: '%' },
  { id: 'separatorOpacity', group: 'effects', type: 'number', property: '--design-separator-opacity', defaults: [5, 5], min: 0, max: 100, unit: '%' },
  { id: 'buttonRadius', group: 'shapes', type: 'number', property: '--design-button-radius', defaults: [7.5, 7.5], min: 0, max: 100, step: 0.5, unit: 'px' },
  { id: 'cardRadius', group: 'shapes', type: 'number', property: '--radius-xl', defaults: [7.5, 7.5], min: 0, max: 40, step: 0.5, unit: 'px' },
  { id: 'inputRadius', group: 'shapes', type: 'number', property: '--design-input-radius', defaults: [7.5, 7.5], min: 0, max: 40, step: 0.5, unit: 'px' },
  { id: 'logoScale', group: 'shapes', type: 'number', property: '--design-logo-scale', defaults: [100, 100], min: 50, max: 100, unit: '%' },
  { id: 'buttonShadow', group: 'effects', type: 'number', property: '--design-button-shadow-size', defaults: [0, 0], min: 0, max: 32, unit: 'px' },
  { id: 'buttonInset', group: 'effects', type: 'number', property: '--design-button-inset-size', defaults: [0, 0], min: 0, max: 24, unit: 'px' },
  { id: 'cardShadow', group: 'effects', type: 'number', property: '--design-card-shadow-size', defaults: [0, 0], min: 0, max: 32, unit: 'px' },
  { id: 'shadowOpacity', group: 'effects', type: 'number', property: '--design-shadow-opacity', defaults: [20, 20], min: 0, max: 60, unit: '%' },
  { id: 'scrollbarColor', group: 'scrollbars', type: 'color', property: '--design-scrollbar-color', defaults: ['#777777', '#999999'] },
  { id: 'scrollbarWidth', group: 'scrollbars', type: 'number', property: '--design-scrollbar-width', defaults: [4, 4], min: 2, max: 10, unit: 'px' },
  { id: 'scrollbarIdle', group: 'scrollbars', type: 'number', property: '--design-scrollbar-idle', defaults: [10, 10], min: 0, max: 100, unit: '%' },
  { id: 'scrollbarFade', group: 'scrollbars', type: 'number', property: '--design-scrollbar-fade', defaults: [200, 200], min: 0, max: 2000, unit: 'ms' },
  { id: 'animationDuration', group: 'motion', type: 'number', property: '--design-animation-duration', defaults: [200, 200], min: 0, max: 1000, unit: 'ms' },
  ...gradientTargets.flatMap((target): TField[] => [
    { id: `${target}GradientColor`, group: 'gradients', type: 'color', property: `--design-${target}-gradient-color`, defaults: ['#ffffff', '#000000'] },
    { id: `${target}GradientStrength`, group: 'gradients', type: 'number', property: `--design-${target}-gradient-strength`, defaults: [0, 0], min: 0, max: 100, unit: '%' },
    { id: `${target}GradientAngle`, group: 'gradients', type: 'number', property: `--design-${target}-gradient-angle`, defaults: [180, 180], min: 0, max: 360, unit: 'deg' },
  ]),
];

export const appearanceValue = (values: TAppearance, field: TField, mode: TAppearanceMode) =>
  values[field.id] ?? field.defaults[mode === 'dark' ? 1 : 0];

const storageKey = 'bitbox.desktop-appearance';
const sanitize = (value: unknown): TAppearance => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const input = value as Record<string, unknown>;
  return Object.fromEntries(appearanceFields.flatMap(field => {
    const item = input[field.id];
    const valid = (field.type === 'color'
      ? typeof item === 'string' && /^#[0-9a-f]{6}$/i.test(item)
      : typeof item === 'number' && Number.isFinite(item) && item >= field.min && item <= field.max &&
        Number.isInteger(item / (field.step ?? 1)));
    return valid ? [[field.id, item as string | number]] : [];
  }));
};

export const readAppearance = (): Record<TAppearanceMode, TAppearance> => {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return { light: sanitize(data?.light), dark: sanitize(data?.dark) };
  } catch {
    return { light: {}, dark: {} };
  }
};

export const saveAppearance = (mode: TAppearanceMode, values: TAppearance) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...readAppearance(), [mode]: sanitize(values) }));
    return true;
  } catch {
    return false;
  }
};

export const applyAppearance = (input: TAppearance, mode: TAppearanceMode) => {
  const values = sanitize(input);
  const style = document.body.style;
  appearanceFields.forEach(field => {
    const value = values[field.id];
    if (value === undefined) {
      style.removeProperty(field.property);
    } else {
      style.setProperty(field.property, `${value}${field.type === 'number' ? field.unit : ''}`);
    }
  });
  // Semantic aliases are inherited as computed values; update them alongside the accent.
  ['--color-primary', '--background-blue', '--color-blue-rgb'].forEach(property => style.removeProperty(property));
  const accent = values.accent;
  if (typeof accent === 'string') {
    style.setProperty('--color-primary', accent);
    style.setProperty('--background-blue', accent);
    style.setProperty('--color-blue-rgb', [1, 3, 5].map(index => parseInt(accent.slice(index, index + 2), 16)).join(', '));
  }
  gradientTargets.forEach(target => {
    const color = values[`${target}GradientColor`] ?? (mode === 'dark' ? '#000000' : '#ffffff');
    const strength = values[`${target}GradientStrength`] ?? 0;
    const angle = values[`${target}GradientAngle`] ?? 180;
    style.setProperty(`--design-${target}-gradient`, Number(strength) > 0
      ? `linear-gradient(${angle}deg, transparent, color-mix(in srgb, ${color} ${strength}%, transparent))` : 'none');
  });
  window.dispatchEvent(new Event('bitbox-chrome-layout'));
};
