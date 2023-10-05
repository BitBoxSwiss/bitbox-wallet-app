/**
 * Copyright 2023 Shift Crypto AG
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
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { ButtonLink, Button } from './button';

describe('components/forms/button', () => {
  describe('ButtonLink', () => {
    it('renders as button when disabled with disabled attribute', () => {
      render(<ButtonLink primary to="/settings" disabled>A ButtonLink</ButtonLink>);
      expect(screen.getByRole('button', { name: /A ButtonLink/i })).toHaveAttribute('disabled');
    });

    it('renders as link when not disabled', () => {
      render(<ButtonLink transparent to={'/settings'}>A ButtonLink</ButtonLink>, { wrapper: MemoryRouter });
      expect(screen.getByRole('link', { name: /A ButtonLink/i })).toBeInTheDocument();
    });
  });

  describe('Button', () => {
    it('renders a button with proper styling', () => {
      render(<Button primary>A Button</Button>);
      expect(screen.getByRole('button', { name: /A Button/i }).getAttribute('class')).toContain('primary');
    });
  });
});
