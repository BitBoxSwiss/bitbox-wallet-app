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

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Entry, TEntryProp } from './entry';

vi.mock('../../utils/request', () => ({
  apiGet: vi.fn().mockResolvedValue(''),
}));

describe('components/guide/entry', () => {
  describe('renders correct entry values', () => {
    it('collapsed', () => {
      const EntryProps: TEntryProp = {
        title: 'A title',
        text: 'Some text',
      };
      const { container } = render(<Entry key={'key'} entry={EntryProps} />);

      expect(container).toHaveTextContent('A title');
      expect(container).not.toHaveTextContent('Some text');
    });

    it('opened', () => {
      const EntryProps: TEntryProp = {
        title: 'A title',
        text: 'Some text',
      };
      const { container } = render(<Entry key={'key'} entry={EntryProps} shown />);

      expect(container).toHaveTextContent('A title');
      expect(container).toHaveTextContent('Some text');
    });

    it('collapsed & has a link ', () => {
      const EntryProps: TEntryProp = {
        title: 'A title',
        text: 'Some text',
        link: {
          url: 'http://someurl.com',
          text: 'some url'
        }
      };
      const { container, queryByTestId } = render(<Entry key={'key'} entry={EntryProps} />);

      const link = queryByTestId('link');

      expect(container).toHaveTextContent('A title');
      expect(container).not.toHaveTextContent('Some text');
      expect(container).not.toHaveTextContent('some url');
      expect(link).toBeNull();
    });

    it('opened & has a link ', () => {
      const EntryProps: TEntryProp = {
        title: 'A title',
        text: 'Some text',
        link: {
          url: 'http://someurl.com',
          text: 'some url'
        }
      };
      const { container, getByTestId } = render(<Entry key={'key'} entry={EntryProps} shown />);

      const link = getByTestId('link');

      expect(container).toHaveTextContent('A title');
      expect(container).toHaveTextContent('Some text');
      expect(container).toHaveTextContent('some url');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('title', 'http://someurl.com');
    });
  });
});
