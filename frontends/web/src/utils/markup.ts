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

import React, { createElement } from 'react';

type MarkupProps = {
    tagName: keyof JSX.IntrinsicElements;
    markup: string;
    key?: string;
} & React.HTMLAttributes<HTMLElement>;

const captureStrongElement = /^(.*)<strong>(.*)<\/strong>(.*)$/;

/**
 * **SimpleMarkup** renders `foo <strong>bar</strong> baz` safely as
 * `foo <strong>bar</strong> baz`. Anything else is rendered as
 * sanitized text.
 * Only one occurence of <strong> is supported to keep it simple.
 * ### Example:
 * ```jsx
    <SimpleMarkup tagName="p" markup="foo <strong>bar</strong> baz" />
 * ```
 */
export function SimpleMarkup({ tagName, markup, ...props }: MarkupProps) {
  if (typeof markup !== 'string') {
    return null;
  }
  const simpleMarkupChunks = captureStrongElement.exec(markup);
  if (simpleMarkupChunks === null || simpleMarkupChunks.length !== 4) {
    return createElement(tagName, props, markup);
  }
  return createElement(tagName, props, simpleMarkupChunks[1], createElement('strong', null, simpleMarkupChunks[2]), simpleMarkupChunks[3]);
}

/**
 * **multilineMarkup** splits a text by newline and renders each
 * line with the `<SimmpleMarkup>` component.
 * **Note**: With current Preact 8 document fragments are not
 * supported so this has to be used as function, but once we move
 * to modern Preact/React we can use it as a normal component.
 * ### Example:
 * ```jsx
    {multilineMarkup({ tagName: 'p', markup: 'messages\n\nwith <strong>newlines</strong>'})}
 * ```
 */
export function multilineMarkup({ tagName, markup, ...props }: MarkupProps) {
  return markup.split('\n').map((line: string, i: number) => (
    SimpleMarkup({
      key: `${line}-${i}`,
      tagName,
      markup: line,
      ...props
    })
  ));
}
