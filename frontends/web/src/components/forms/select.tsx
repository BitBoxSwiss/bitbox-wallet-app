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
import { select } from './select.module.css';

type TOptionTextContent = {
    text: string;
}

type TOption = JSX.IntrinsicElements['option'] & TOptionTextContent

type TSelectProps = {
    // Temp add defaultValue, see https://github.com/preactjs/preact/issues/2668
    defaultValue?: string;
    id: string;
    label?: string;
    options: TOption[];
    selectedOption?: string;
} & JSX.IntrinsicElements['select']

export function Select({
    id,
    label,
    options = [],
    selectedOption,
    ...props
}: TSelectProps) {
    return (
        <div className={select}>
            {label && <label for={id}>{label}</label>}
            <select id={id} {...props}>
                {options.map(({ value, text, disabled = false }) => (
                    <option
                        key={`${value}`}
                        value={value}
                        disabled={disabled}
                        selected={selectedOption === value}>
                        {text}
                    </option>
                ))}
            </select>
        </div>
    );
}
