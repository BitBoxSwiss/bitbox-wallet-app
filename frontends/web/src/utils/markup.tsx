// SPDX-License-Identifier: Apache-2.0

import React, { Fragment, createElement } from 'react';

type TMarkupProps = {
  tagName: keyof JSX.IntrinsicElements;
  markup: string;
  key?: string;
} & React.HTMLAttributes<HTMLElement>;

const captureStrongElement = /^(.*)<strong>(.*)<\/strong>(.*)$/m;

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
export const SimpleMarkup = ({ tagName, markup, ...props }: TMarkupProps) => {
  if (typeof markup !== 'string') {
    return null;
  }
  const simpleMarkupChunks = captureStrongElement.exec(markup);
  if (simpleMarkupChunks === null || simpleMarkupChunks.length !== 4) {
    return createElement(tagName, props, markup);
  }
  return createElement(tagName, props, simpleMarkupChunks[1], createElement('strong', null, simpleMarkupChunks[2]), simpleMarkupChunks[3]);
};

type TMultiMarkupProps = {
  withBreaks?: boolean;
} & TMarkupProps;

/**
 * **<MultilineMarkup>** splits a text by newline and renders each
 * line with the `<SimmpleMarkup>` component.
 */
export const MultilineMarkup = ({ tagName, markup, withBreaks, ...props }: TMultiMarkupProps) => {
  return (
    <>
      { markup.split('\n').map((line: string, i: number) => (
        <Fragment key={`${line}-${i}`}>
          <SimpleMarkup tagName={tagName} markup={line} {...props} />
          {withBreaks && (<br />)}
        </Fragment>
      )) }
    </>
  );
};
