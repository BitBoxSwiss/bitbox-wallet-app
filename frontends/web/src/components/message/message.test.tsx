// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Message } from './message';

describe('components/message/message', () => {

  it('should return return null', () => {
    const msg = render(<Message hidden><span>hello</span></Message>);
    expect(msg.container).toBeEmptyDOMElement();
  });

  it('should preserve text', () => {
    const msg = render(<Message><span>hello world</span></Message>);
    expect(msg.findByText('hello world')).not.toBeNull();
  });
});
