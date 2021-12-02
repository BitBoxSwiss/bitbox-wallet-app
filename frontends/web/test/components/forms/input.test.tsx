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

import 'jest';
import { h, createRef } from 'preact';
import { deep, shallow } from 'preact-render-spy';

import Input, { Props } from '../../../src/components/forms/input';

describe('components/forms/input', () => {
    it('should preserve style attribute', () => {
        const input = deep<Props, {}>(<Input type="password" style="width:100%">content</Input>);
        expect(input.first<Props, {}>().attr('style')).toBe('width:100%');
        expect(input.first<Props, {}>().attr('type')).toBe('password');
    });

    it('should have child nodes', () => {
        const input = shallow(<Input><span>label</span></Input>);
        expect(input.children()[0]).toEqual(<span>label</span>);
    });

    it('should set the input ref with inputRef', () => {
        let inputRef = createRef<HTMLInputElement>();
        shallow(<Input inputRef={inputRef} />);
        expect(inputRef.current!.nodeName).toEqual('INPUT');
    });

    it('should preserve text', () => {
        const input = shallow(<Input label="Label" error="text too short" />);
        expect(input.text()).toBe('Label:text too short');
    });
});
