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
import { Link } from 'preact-router/match';
import * as style from './button.css';

export function ButtonLink({
    primary = false,
    secondary = false,
    transparent = false,
    danger = false,
    className = '',
    tabIndex = 0,
    children,
    disabled = undefined,
    ...props
}) {
    const classNames = [
        style[primary && 'primary'
        || secondary && 'secondary'
        || transparent && 'transparent'
        || danger && 'danger'
        || 'button'
        ], className
    ].join(' ');

    if (disabled) {
        return (
            <Button
                primary={primary}
                secondary={secondary}
                transparent={transparent}
                danger={danger}
                disabled={disabled}
                {...props}>
                {children}
            </Button>
        );
    }
    return (
        <Link activeClassName="active" className={classNames} tabIndex={tabIndex} {...props}>
            {children}
        </Link>
    );
}

export default function Button({
    type = 'button',
    primary = false,
    secondary = false,
    transparent = false,
    danger = false,
    className = '',
    children,
    ...props
}) {
    const classNames = [
        style[primary && 'primary'
        || secondary && 'secondary'
        || transparent && 'transparent'
        || danger && 'danger'
        || 'button'
        ], className
    ].join(' ');

    return (
        <button
            type={type}
            className={classNames}
            {...props}>
            {children}
        </button>
    );
}
