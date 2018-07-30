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
import { input, errorText, isTransparent } from './input.css';

export default function Input({
    type = 'text',
    disabled,
    label,
    id,
    error,
    className,
    style,
    children,
    getRef,
    transparent,
    ...props
}) {
    return (
        <div className={[input, className, transparent ? isTransparent : ''].join(' ')} style={style}>
            {
                label && (
                    <label for={id} class={error ? errorText : ''}>
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
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                type={type}
                id={id}
                disabled={disabled}
                ref={getRef}
                {...props}
            />
            {children}
        </div>
    );
}
