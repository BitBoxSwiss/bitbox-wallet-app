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
import { apiPost } from '../../utils/request';
import * as style from './anchor.css';

interface Properties {
    href: string;
    children?: any;
    [property: string]: any;
}

export default function A({ href, children, ...props }: RenderableProps<Properties>): JSX.Element {
    return (
        <span className={style.link} onClick={() => apiPost('open', href)} title={href} {...props}>
            {children}
        </span>
    );
}
