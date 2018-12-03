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

import { h, RenderableProps } from 'preact';
import * as styles from './input.css';

export interface Props {
    autoComplete?: boolean | 'on' | 'off';
    autoFocus?: boolean;
    children?: any; // can be removed once preact > 8.3.1
    className?: string;
    disabled?: boolean;
    error?: string | object;
    getRef?: (node: JSX.Element) => void;
    id?: string;
    label?: string;
    name?: string;
    onInput?: (e: any) => void;
    onPaste?: (e: any) => void;
    pattern?: string;
    placeholder?: string;
    style?: string;
    title?: string;
    transparent?: boolean;
    type?: 'text' | 'password';
    value?: string | number;
    // [property: string]: any;
}

export default function Input({
    id,
    label = '',
    error,
    className = '',
    style = '',
    children,
    getRef,
    transparent = false,
    type = 'text',
    ...props
}: RenderableProps<Props>): JSX.Element {
    return (
        <div className={[styles.input, className, transparent ? styles.isTransparent : ''].join(' ')} style={style}>
            {
                label && (
                    <label for={id} class={error ? styles.errorText : ''}>
                        {label}
                        {
                            error && (
                                <span>:<span>{error}</span></span>
                            )
                        }
                    </label>
                )
            }
            <input
                autocomplete="off"
                autocorrect="off"
                spellcheck={false}
                type={type}
                id={id}
                ref={getRef}
                {...props}
            />
            {children}
        </div>
    );
}
