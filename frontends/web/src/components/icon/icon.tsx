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
import alert from './assets/icons/alert-triangle.svg';
import BB02Stylized from '../../assets/device/bitbox02-stylized-reflection.png';
import info from './assets/icons/info.svg';
import arrowDownSVG from './assets/icons/arrow-down-active.svg';
import checkSVG from './assets/icons/check.svg';
import cancelSVG from './assets/icons/cancel.svg';
import copySVG from './assets/icons/copy.svg';
import closeSVG from './assets/icons/close.svg';
import * as style from './icon.module.css';

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

type SVGProps = JSX.IntrinsicElements['svg'];

export const Checked = ({className, ...props}: SVGProps) => (
    <svg className={`checked ${className || ''}`} viewBox="0 0 52 52" draggable={false} {...props}>
        <circle className="checked-circle" cx="26" cy="26" r="25" fill="none"/>
        <path className="checked-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
    </svg>
);

export const CaretDown = ({className, ...props}: SVGProps) => (
    <svg className={`caretDown ${className || ''}`} viewBox="0 0 1024 1024" draggable={false} {...props}>
        <path d="M840.4 300H183.6c-19.7 0-30.7 20.8-18.5 35l328.4 380.8c9.4 10.9 27.5 10.9 37 0L858.9 335c12.2-14.2 1.2-35-18.5-35z"></path>
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

type ImgProps = JSX.IntrinsicElements['img'];

export const Alert = (props: ImgProps) => (<img src={alert} draggable={false} {...props} />);
export const Info = (props: ImgProps) => (<img src={info} draggable={false} {...props} />);
export const BitBox02Stylized = (props: ImgProps) => (<img src={BB02Stylized} draggable={false} {...props} />);
export const ArrowDown = (props: ImgProps) => (<img src={arrowDownSVG} draggable={false} {...props} />);
export const Check = (props: ImgProps) => (<img src={checkSVG} draggable={false} {...props} />);
export const Cancel = (props: ImgProps) => (<img src={cancelSVG} draggable={false} {...props} />);
export const Copy = (props: ImgProps) => (<img src={copySVG} draggable={false} {...props} />);
export const Close = (props: ImgProps) => (<img src={closeSVG} draggable={false} {...props} />);
