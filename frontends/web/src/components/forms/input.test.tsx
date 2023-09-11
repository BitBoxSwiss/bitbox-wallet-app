/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Input from './input';

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
