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

import { h, JSX } from 'preact';
import alert from './assets/icons/alert-triangle.svg';
import info from './assets/icons/info.svg';
import * as style from './icon.css';

export function Alert(props): JSX.Element {
    return (
        <img draggable={false} src={alert} {...props} />
    );
}

export const ExpandOpen = (): JSX.Element => (
    <svg
        className={style.expandIcon}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <line x1="11" y1="8" x2="11" y2="14"></line>
        <line x1="8" y1="11" x2="14" y2="11"></line>
    </svg>
);

export const ExpandClose = (): JSX.Element => (
    <svg
        className={style.expandIcon}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <line x1="8" y1="11" x2="14" y2="11"></line>
    </svg>
);

interface ExpandIconProps {
    expand: boolean;
}

export const ExpandIcon = ({
    expand = true,
}: ExpandIconProps): JSX.Element => (
    expand ? <ExpandOpen /> : <ExpandClose />
);

interface InfoProps {
    className?: string;
}

export function Info(props: InfoProps) {
    return (
        <img src={info} {...props} />
    );
}
