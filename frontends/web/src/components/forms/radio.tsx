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

import { h, JSX } from 'preact';
import * as style from './radio.css';

export function Radio({
    disabled = false,
    label,
    id,
    children,
    ...props
}: JSX.IntrinsicElements['input']) {
    return (
        <span className={style.radio}>
            <input
                type="radio"
                id={id}
                name={id}
                disabled={disabled}
                {...props}
            />
            <label for={id}>
                {label}
                {children}
            </label>
        </span>
    );
}
