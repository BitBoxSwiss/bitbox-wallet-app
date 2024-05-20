/**
 * Copyright 2024 Shift Crypto AG
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

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NumberInput } from './input-number';

describe('components/forms/input-number', () => {
  it('should preserve type attribute', () => {
    const { container } = render(<NumberInput defaultValue="" />);
    expect(container.querySelector('[type="number"')).toBeTruthy();
  });

  it('should have children', () => {
    render(<NumberInput defaultValue=""><span>label</span></NumberInput>);
    expect(screen.getByText('label')).toBeTruthy();
  });

  it('should have a label', () => {
    render(<NumberInput id="myInput" label="Label" defaultValue="" />);
    expect(screen.getByLabelText('Label')).toBeTruthy();
  });

  it('should preserve text', () => {
    render(<NumberInput label="Label" error="text too short" defaultValue="" />);
    expect(screen.getByText('text too short')).toBeTruthy();
  });

  it('should paste supported number formats', async () => {
    const mockCallback = vi.fn();
    render(
      <NumberInput placeholder="Number input" onChange={mockCallback} />
    );
    const input = screen.queryByPlaceholderText('Number input');
    if (!input) {
      throw new Error('Input not found');
    }
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => '1,000,000.50'
      }
    });
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
      target: expect.objectContaining({ value: '1000000.50' })
    }));

    fireEvent.paste(input, { clipboardData: { getData: () => '100.50' } });
    expect(mockCallback).toHaveBeenCalledTimes(2);
    expect(mockCallback.mock.calls[1][0].target.value).toBe('100.50');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1,0' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1.0');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1,0' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1.0');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1,00' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1.00');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1.00' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1.00');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1,000' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1.000');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1,000.00' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1000.00');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1.000,00' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1000.00');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '100,50' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('100.50');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '100.00' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('100.00');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '100,000' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('100.000');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '100.000' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('100.000');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '.99' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('.99');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => ',99' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('.99');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '0.0000000000000000001' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('0.0000000000000000001');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '0,0000000000000000001' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('0.0000000000000000001');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1\'000\'000.50' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1000000.50');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1\'000\'000,50' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1000000.50');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1 000 000.50' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1000000.50');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1.000.000,50' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1000000.50');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1 000.50' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1000.50');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1.000,50' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1000.50');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1,000.50' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1000.50');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1,000,000.50' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1000000.50');
  });

  it('has some unsupported number formats', async () => {
    const mockCallback = vi.fn();
    render(
      <NumberInput placeholder="Weird formats" onChange={mockCallback} />
    );
    const input = screen.queryByPlaceholderText('Weird formats');
    if (!input) {
      throw new Error('Input not found');
    }

    fireEvent.paste(input, { clipboardData: { getData: () => '100,' } });
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback.mock.calls[0][0].target.value).toBe('');

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1,000.000,50' } });
    expect(mockCallback).toHaveBeenCalledTimes(0);

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1,,000' } });
    expect(mockCallback).toHaveBeenCalledTimes(0);

    mockCallback.mockClear();
    fireEvent.paste(input, { clipboardData: { getData: () => '1,000' } });
    expect(mockCallback.mock.calls[0][0].target.value).toBe('1.000');

  });

});
