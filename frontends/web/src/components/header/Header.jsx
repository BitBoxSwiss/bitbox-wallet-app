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
import menuIcon from '../../assets/icons/menu.svg';
import chevronsRight from '../../assets/icons/chevrons-right.svg';
import style from './Header.css';

export default class Header extends Component {
    render({
      sidebar,
      guide,
      extraContent,
      children,
    }, {

    }) {
        return (
            <div class="headerContainer">
                <div class="header">
                    <div class={[style.sidebarTogglerContainer, guide.shown ? style.withGuide : ''].join(' ')} onClick={sidebar.toggle}>
                        <div class={style.sidebarToggler}>
                            <img src={chevronsRight} />
                        </div>
                    </div>
                    {children}
                </div>
                {extraContent && extraContent()}
            </div>
        );
    }
}
