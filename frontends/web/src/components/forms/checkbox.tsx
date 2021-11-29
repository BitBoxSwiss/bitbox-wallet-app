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

import { h, JSX, RenderableProps } from 'preact';
import * as styles from './checkbox.module.css';

type CheckboxProps = JSX.IntrinsicElements['input'] & {
    className?: string;
    disabled?: boolean;
    label?: string;
    id: string;
    style?: 'default' | 'info' | 'warning' | 'success';
}

export default function Checkbox({
    disabled = false,
    label,
    id,
    className = '',
    children,
    style = 'default',
    ...props
}: RenderableProps<CheckboxProps>) {
    return (
        <span className={`${styles.checkbox} ${className} ${styles[style] || ''}`}>
            <input
                type="checkbox"
                id={id}
                disabled={disabled}
                {...props}
            />
            <label for={id}>{label} {children}</label>
        </span>
    );
}
