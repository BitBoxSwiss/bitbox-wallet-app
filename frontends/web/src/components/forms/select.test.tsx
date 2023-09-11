/**
 * Copyright 2022 Shift Crypto AG
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

import React from 'react';
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
