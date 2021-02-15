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

import { h } from 'preact';
import { mount, shallow } from 'enzyme';

import { Message } from '../../../src/components/message/message';

describe('components/message/message', () => {
    it('should use type attr as CSS class', () => {
        const msg = mount(<Message type="warning">content</Message>);
        expect(msg.text()).toContain('content');
    });

    it('should preserve style attribute', () => {
        const msg = mount(<Message style="width:100%">content</Message>);
        expect(msg.first().prop('style')).toBe('width:100%');
    });

    it('should have child nodes', () => {
        const msg = shallow(<Message><span>hello</span></Message>);
        expect(msg.children('span').text()).toEqual('hello');
    });

    it('should preserve text', () => {
        const msg = shallow(<Message><span>hello world</span></Message>);
        expect(msg.text()).toBe('hello world');
    });

    it('should match the snapshot', () => {
        const msg = mount(
            <Message type="success" style="width:100%">
                <span>hello</span>
            </Message>,
        );
        expect(msg).toMatchSnapshot();
    });
});
