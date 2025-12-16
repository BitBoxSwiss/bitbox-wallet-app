// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Checkbox } from './checkbox';

describe('components/forms/checkbox', () => {
  it('renders checkbox with proper attributes', () => {
    render(<Checkbox checkboxStyle="info" label="my checkbox label" id="checkbox" />);
    const renderedCheckbox = screen.getByRole('checkbox', { name: 'my checkbox label' });
    const checkboxWrapper = renderedCheckbox.parentElement;
    expect(renderedCheckbox).toBeInTheDocument();
    expect(checkboxWrapper?.getAttribute('class')).toContain('info');
  });
});
