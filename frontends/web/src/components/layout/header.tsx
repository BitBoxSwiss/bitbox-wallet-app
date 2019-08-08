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
import MenuIcon from '../../assets/icons/menu.svg';
import { share } from '../../decorators/share';
import { SharedProps as SharedPanelProps, store as panelStore } from '../guide/guide';
import { shown as guideShown, toggle as toggleGuide } from '../guide/guide';
import { toggleSidebar } from '../sidebar/sidebar';
import * as style from './header.css';

interface HeaderProps {
    toggleSidebar?: () => void;
    title: JSX.Element | JSX.Element[];
    narrow?: boolean;
}
type Props = HeaderProps & SharedPanelProps;

function Header(
    { title, narrow, children }: RenderableProps<Props>,
): JSX.Element {
    const hasChildren = Array.isArray(children) && children.length > 0;
    return (
        <div className={[style.container].join(' ')}>
            <div className={[style.header, narrow ? style.narrow : ''].join(' ')}>
                <div className={style.sidebarToggler} onClick={toggleSidebar}>
                    <img src={MenuIcon} />
                </div>
                <div className={style.title}>{title}</div>
                <div className={style.children}>
                    {hasChildren && children}
                    {
                        guideShown() ? (
                            <a href="#" onClick={toggleGuide} className={style.guideIconContainer}>
                                <svg className={style.guideIcon} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                </svg>
                            </a>
                        ) : (
                            <a href="#" onClick={toggleGuide} className={style.guideIconContainer}>
                                <svg className={style.guideIcon} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                </svg>
                            </a>
                        )
                    }
                </div>
            </div>
        </div>
    );
}

const SharedHeader = share<SharedPanelProps, HeaderProps>(panelStore)(Header);
export { SharedHeader as Header };
