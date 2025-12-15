// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select, TOption } from './select';

describe('components/forms/select', () => {
  it('renders select component with proper options', () => {
    const MOCK_OPTIONS: TOption[] = [
      { value: '1', text: 'one', disabled: false },
      { value: '2', text: 'two', disabled: false },
      { value: '3', text: 'three', disabled: false }
    ];
    render(<Select label="my select label" options={MOCK_OPTIONS} id="select" />);
    expect(screen.getByRole('combobox', { name: 'my select label' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });
});
