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

import Input from '../../../src/components/forms/input';

describe('components/forms/input', () => {
    it('should preserve style attribute', () => {
        const input = mount(<Input type="password" style="width:100%">content</Input>);
        expect(input.first().prop('style')).toBe('width:100%');
        expect(input.first().prop('type')).toBe('password');
    });

    it('should have child nodes', () => {
        const input = mount(<Input><span>label</span></Input>);
        expect(input.find('span').children()).toContain('label');
    });

    it('should return the input node with getRef', () => {
        mount(<Input getRef={node => {
            expect(node?.nodeName).toEqual('INPUT');
        }} />);
    });

    it('should preserve text', () => {
        const input = shallow(<Input label="Label" error="text too short" />);
        expect(input.text()).toBe('Label:text too short');
    });
});
