// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Radio } from './radio';

describe('components/forms/radio', () => {
  it('renders radio button properly', () => {
    render(<Radio id="radio" label="my radio label"></Radio>);
    expect(screen.getByRole('radio', { name: 'my radio label' })).toBeInTheDocument();
  });
});
