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

import { render, screen } from '@testing-library/react';
import { SimpleMarkup } from './markup';

describe('SimpleMarkup', () => {
    it('contains a strong element with the text bar', () => {
        const { container } = render(<SimpleMarkup tagName="p" markup="foo <strong>bar</strong> baz" />);
        expect(screen.getByText('bar')).toBeTruthy();
        expect(container.getElementsByTagName('strong')).not.toBeFalsy();



        // expect(screen.output().nodeName).toEqual('p');
        // expect(paragaph.find('strong').text()).toEqual('bar');
    });
    // it('should but doesnt support multiple strong elements', () => {
    //     const span = shallow(<SimpleMarkup tagName="span" markup="<strong>foo</strong> <strong>bar</strong> <strong>baz</strong>" />);
    //     expect(span.output().nodeName).toEqual('span');
    //     expect(span.text()).toEqual('<strong>foo</strong> <strong>bar</strong> baz');
    //     // Only the last strong element is currently supported :/
    //     expect(span.output().children[0]).toEqual('<strong>foo</strong> <strong>bar</strong> ');
    //     expect(span.output().children[1]).toEqual(<strong>baz</strong>)
    // });
});
