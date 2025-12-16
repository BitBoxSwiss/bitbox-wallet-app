// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './input';

describe('components/forms/input', () => {
  it('should preserve type attribute', () => {
    const { container } = render(<Input type="password" defaultValue="" />);
    expect(container.querySelector('[type="password"')).toBeTruthy();
  });

  it('should have children', () => {
    render(<Input defaultValue=""><span>label</span></Input>);
    expect(screen.getByText('label')).toBeTruthy();
  });

  it('should have a label', () => {
    render(<Input id="myInput" label="Label" defaultValue="" />);
    expect(screen.getByLabelText('Label')).toBeTruthy();
  });

  it('should preserve text', () => {
    render(<Input label="Label" error="text too short" defaultValue="" />);
    expect(screen.getByText('text too short')).toBeTruthy();
  });
});
