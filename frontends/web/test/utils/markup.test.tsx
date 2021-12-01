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
import { h } from 'preact';
import { deep, shallow } from 'preact-render-spy';
import { multilineMarkup, SimpleMarkup } from '../../src/utils/markup';

describe('SimpleMarkup', () => {
    it('contains a strong element with the text bar', () => {
        const paragaph = shallow(<SimpleMarkup tagName="p" markup="foo <strong>bar</strong> baz" />);
        expect(paragaph.output().nodeName).toEqual('p');
        expect(paragaph.find('strong').text()).toEqual('bar');
    });
    it('should but doesnt support multiple strong elements', () => {
        const span = shallow(<SimpleMarkup tagName="span" markup="<strong>foo</strong> <strong>bar</strong> <strong>baz</strong>" />);
        expect(span.output().nodeName).toEqual('span');
        expect(span.text()).toEqual('<strong>foo</strong> <strong>bar</strong> baz');
        // Only the last strong element is currently supported :/
        expect(span.output().children[0]).toEqual('<strong>foo</strong> <strong>bar</strong> ');
        expect(span.output().children[1]).toEqual(<strong>baz</strong>)
    });
});

describe('multilineMarkup', () => {
    it('contains multiple lines with a strong element each', () => {
        const multiline = deep(
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
