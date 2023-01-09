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

import 'jest';
import { render } from '@testing-library/react';
import { MultilineMarkup, SimpleMarkup } from './markup';

describe('SimpleMarkup', () => {
  it('contains a strong element with the text bar', () => {
    const { container } = render(<SimpleMarkup tagName="p" markup="foo <strong>bar</strong> baz" />);
    // container is a div that wraps whatever element that's being rendered
    expect(container.firstElementChild?.nodeName).toBe('P');
    expect(container.querySelector('strong')).toHaveTextContent('bar');
  });
  it('should but doesnt support multiple strong elements', () => {
    const { container } = render(<SimpleMarkup tagName="span" markup="<strong>foo</strong> <strong>bar</strong> <strong>baz</strong>" />);
    expect(container.firstElementChild?.nodeName).toBe('SPAN');
    expect(container.textContent).toBe('<strong>foo</strong> <strong>bar</strong> baz');
  });
});

describe('multilineMarkup', () => {
  it('contains multiple lines with a strong element each', () => {
    const { container } = render(
      <MultilineMarkup tagName="p" markup={'foo <strong>bar</strong> baz\n<strong>booz</strong>'}/>
    );
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    const first = paragraphs[0];
    const last = paragraphs[1];
    expect(first.textContent).toBe('foo bar baz');
    expect(first.querySelector('strong')).toHaveTextContent('bar');
    expect(last.textContent).toBe('booz');
    expect(last.querySelector('strong')).toHaveTextContent('booz');
  });
});

describe('multilineMarkup with breaks', () => {
  it('contains multiple lines with a strong element each', () => {
    const { container } = render(
      <MultilineMarkup markup={'one\ntwo'} tagName="span" withBreaks />
    );
    const paragraphs = container.querySelectorAll('span');
    expect(paragraphs).toHaveLength(2);
    const breaks = container.querySelectorAll('br');
    expect(breaks).toHaveLength(2);
  });
});
