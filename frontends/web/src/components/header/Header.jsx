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

import { h, Component } from 'preact';
import { share } from '../../decorators/share';
import { store } from '../guide/guide';
import MenuIcon from '../../assets/icons/menu.svg';
import * as style from './Header.css';

// @ts-ignore (generics need to be typed explicitly once converted to TypeScript)
@share(store)
export default class Header extends Component {
    toggleGuide = e => {
        e.preventDefault();
        store.setState({ shown: !store.state.shown });
    }

    render({
        title = null,
        toggleSidebar = null,
        children,
    }) {
        return (
            <div className={style.container}>
                <div className={[style.header, children.length > 0 ? style.children : ''].join(' ')}>
                    <div className={style.sidebarToggler} onClick={toggleSidebar}>
                        <img src={MenuIcon} />
                    </div>
                    <div className={style.title}>{title}</div>
                    <div className={style.guideWrapper} onClick={this.toggleGuide}>
                        <div className={style.guideToggler}>
                            <span>{store.state.shown ? '✕' : '?'}</span>
                        </div>
                    </div>
                </div>
                {
                    children.length > 0 && (
                        <div className={style.children}>
                            {children}
                        </div>
                    )
                }
            </div>
        );
    }
}
