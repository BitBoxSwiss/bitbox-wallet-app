/**
 * Copyright 2018 Shift Devices AG
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
import { render } from '@testing-library/react';
import { Message } from './message';
import '@testing-library/jest-dom'; // TODO needed?

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
