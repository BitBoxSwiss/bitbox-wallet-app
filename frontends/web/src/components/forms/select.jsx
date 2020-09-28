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
import { select } from './select.css';

export default function Select({
    id,
    label = null,
    options = [],
    selected = null,
    ...props
}) {
    return (
        <div className={select}>
            {/* @ts-ignore */}
            {label && <label htmlFor={id}>{label}</label>}
            <select id={id} {...props}>
                {options.map(({ value, text }) => (
                    <option
                        key={value}
                        value={value}
                        selected={selected === value}>
                        {text}
                    </option>
                ))}
            </select>
        </div>
    );
}
