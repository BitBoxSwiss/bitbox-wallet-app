// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MultilineMarkup, SimpleMarkup } from './markup';

describe('SimpleMarkup', () => {
  it('contains a strong element with the text bar', () => {
    const { container } = render(<SimpleMarkup tagName="div" markup="foo <strong>bar</strong> baz" />);
    // container is a div that wraps whatever element that's being rendered
    expect(container.firstElementChild?.nodeName).toBe('DIV');
    expect(container.querySelector('strong')).toHaveTextContent('bar');
  });
  it('should ignore newlines', () => {
    const { container } = render(<SimpleMarkup tagName="p" markup="foo <strong>bar</strong> baz.\n" />);
    // container is a paragraph element that wraps whatever element that's being rendered
    expect(container.firstElementChild?.nodeName).toBe('P');
    expect(container.querySelector('strong')).toHaveTextContent('bar');
  });
  it('should ignore newlines 2', () => {
    const { container } = render(<SimpleMarkup tagName="p" markup="foo \n<strong>bar</strong>\n baz.\n" />);
    expect(container.firstElementChild?.nodeName).toBe('P');
    expect(container.querySelector('strong')).toHaveTextContent('bar');
  });
  it('should ignore newlines 3', () => {
    const { container } = render(<SimpleMarkup tagName="p" markup="foo \n<strong>bar\n bar\n</strong>\n baz.\n" />);
    expect(container.firstElementChild?.nodeName).toBe('P');
    expect(container.querySelector('strong')).toHaveTextContent(/bar(.*)bar(.*)$/i);
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
    // @ts-ignore noUncheckedIndexedAccess
    expect(first.textContent).toBe('foo bar baz');
    // @ts-ignore noUncheckedIndexedAccess
    expect(first.querySelector('strong')).toHaveTextContent('bar');
    // @ts-ignore noUncheckedIndexedAccess
    expect(last.textContent).toBe('booz');
    // @ts-ignore noUncheckedIndexedAccess
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
