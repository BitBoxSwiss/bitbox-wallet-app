/**
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

import 'jest';
import { mount } from 'enzyme';
import { multilineMarkup, SimpleMarkup } from './markup';

describe('SimpleMarkup', () => {
  it('contains a strong element with the text bar', () => {
    const paragaph = mount(<SimpleMarkup tagName="p" markup="foo <strong>bar</strong> baz" />);
    expect(paragaph.getDOMNode().nodeName).toEqual('P');
    expect(paragaph.find('strong').text()).toEqual('bar');
  });
  it('should but doesnt support multiple strong elements', () => {
    const span = mount(<SimpleMarkup tagName="span" markup="<strong>foo</strong> <strong>bar</strong> <strong>baz</strong>" />);
    expect(span.getDOMNode().nodeName).toEqual('SPAN');
    expect(span.text()).toEqual('<strong>foo</strong> <strong>bar</strong> baz');
  });
});

describe('multilineMarkup', () => {
  it('contains multiple lines with a strong element each', () => {
    const multiline = mount(
      <div>
        {multilineMarkup({
          tagName: 'p', markup: 'foo <strong>bar</strong> baz\n<strong>booz</strong>'
        })}
      </div>
    );
    const paragaphs = multiline.first().find('p');
    expect(paragaphs.length).toEqual(2);
    const first = paragaphs.first();
    const last = paragaphs.last();
    expect(first.text()).toEqual('foo bar baz');
    expect(first.find('strong').text()).toEqual('bar');
    expect(last.text()).toEqual('booz');
    expect(last.find('strong').text()).toEqual('booz');
  });
});
