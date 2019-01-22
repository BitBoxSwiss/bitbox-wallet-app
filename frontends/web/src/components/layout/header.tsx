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
        <div className={style.container}>
            <div className={[style.header, narrow ? style.narrow : '', hasChildren ? style.children : ''].join(' ')}>
                <div className={style.sidebarToggler} onClick={toggleSidebar}>
                    <img src={MenuIcon} />
                </div>
                <div className={style.title}>{title}</div>
            </div>
            {
                hasChildren ? (
                    <div className={style.children}>
                        {children}
                    </div>
                ) : null
            }
        </div>
    );
}

const SharedHeader = share<SharedPanelProps, HeaderProps>(panelStore)(Header);
export { SharedHeader as Header };
