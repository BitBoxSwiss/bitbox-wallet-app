// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Entry, TEntryProp } from './entry';

vi.mock('@/utils/request', () => ({
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
