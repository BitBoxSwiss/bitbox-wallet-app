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

import alert from './assets/icons/alert-triangle.svg';
import BB02Stylized from '../../assets/device/bitbox02-stylized-reflection.png';
import info from './assets/icons/info.svg';
import arrowDownSVG from './assets/icons/arrow-down-active.svg';
import arrowCircleLeftSVG from './assets/icons/arrow-circle-left.svg';
import arrowCircleLeftActiveSVG from './assets/icons/arrow-circle-left-active.svg';
import arrowCircleRightSVG from './assets/icons/arrow-circle-right.svg';
import arrowCircleRightActiveSVG from './assets/icons/arrow-circle-right-active.svg';
import checkedSmallSVG from './assets/icons/checked-small.svg';
import checkSVG from './assets/icons/check.svg';
import cancelSVG from './assets/icons/cancel.svg';
import redDotSVG from './assets/icons/red-dot.svg';
import copySVG from './assets/icons/copy.svg';
import closeSVG from './assets/icons/close.svg';
import closeXWhiteSVG from './assets/icons/close-x-white.svg';
import closeXDarkSVG from './assets/icons/close-x-dark.svg';
import guideSVG from './assets/icons/guide.svg';
import menuSVG from './assets/icons/menu.svg';
import warningPNG from './assets/icons/warning.png';
import starSVG from './assets/icons/star.svg';
import starInactiveSVG from './assets/icons/star-inactive.svg';
import style from './icon.module.css';

export const ExpandOpen = () => (
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

export const ExpandClose = () => (
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

export const AnimatedChecked = ({ className, ...props }: SVGProps) => (
  <svg className={`checked ${className || ''}`} viewBox="0 0 52 52" {...props}>
    <circle className="checked-circle" cx="26" cy="26" r="25" fill="none"/>
    <path className="checked-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
  </svg>
);

export const CaretDown = ({ className, ...props }: SVGProps) => (
  <svg className={`caretDown ${className || ''}`} viewBox="0 0 1024 1024" {...props}>
    <path d="M840.4 300H183.6c-19.7 0-30.7 20.8-18.5 35l328.4 380.8c9.4 10.9 27.5 10.9 37 0L858.9 335c12.2-14.2 1.2-35-18.5-35z"></path>
  </svg>
);

interface ExpandIconProps {
    expand: boolean;
}

export const ExpandIcon = ({
  expand = true,
}: ExpandIconProps) => (
  expand ? <ExpandOpen /> : <ExpandClose />
);

type ImgProps = JSX.IntrinsicElements['img'];

export const Info = (props: ImgProps) => (<img src={info} draggable={false} {...props} />);
export const BitBox02Stylized = (props: ImgProps) => (<img src={BB02Stylized} draggable={false} {...props} />);
export const ArrowDown = (props: ImgProps) => (<img src={arrowDownSVG} draggable={false} {...props} />);
export const ArrowCirlceLeft = (props: ImgProps) => (<img src={arrowCircleLeftSVG} draggable={false} {...props} />);
export const ArrowCirlceLeftActive = (props: ImgProps) => (<img src={arrowCircleLeftActiveSVG} draggable={false} {...props} />);
export const ArrowCirlceRight = (props: ImgProps) => (<img src={arrowCircleRightSVG} draggable={false} {...props} />);
export const ArrowCirlceRightActive = (props: ImgProps) => (<img src={arrowCircleRightActiveSVG} draggable={false} {...props} />);
// check icon on a green circle
export const Checked = (props: ImgProps) => (<img src={checkedSmallSVG} draggable={false} {...props} />);
// simple check for copy component
export const Check = (props: ImgProps) => (<img src={checkSVG} draggable={false} {...props} />);
export const Cancel = (props: ImgProps) => (<img src={cancelSVG} draggable={false} {...props} />);
export const RedDot = (props: ImgProps) => (<img src={redDotSVG} draggable={false} {...props} />);
export const Copy = (props: ImgProps) => (<img src={copySVG} draggable={false} {...props} />);
export const Close = (props: ImgProps) => (<img src={closeSVG} draggable={false} {...props} />);
export const CloseXWhite = (props: ImgProps) => (<img src={closeXWhiteSVG} draggable={false} {...props} />);
export const CloseXDark = (props: ImgProps) => (<img src={closeXDarkSVG} draggable={false} {...props} />);
export const GuideActive = (props: ImgProps) => (<img src={guideSVG} draggable={false} {...props} />);
export const Menu = (props: ImgProps) => (<img src={menuSVG} draggable={false} {...props} />);
export const Warning = (props: ImgProps) => (<img src={warningPNG} draggable={false} {...props} />);
export const Star = (props: ImgProps) => (<img src={starSVG} draggable={false} {...props} />);
export const StarInactive = (props: ImgProps) => (<img src={starInactiveSVG} draggable={false} {...props} />);
/**
 * @deprecated Alert is only used for BitBox01 use `Warning` icon instead
 */
export const Alert = (props: ImgProps) => (<img src={alert} draggable={false} {...props} />);
