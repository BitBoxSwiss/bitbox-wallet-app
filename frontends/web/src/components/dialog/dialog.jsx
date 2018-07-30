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

import { Component } from 'preact';
import style from './dialog.css';


export default class Dialog extends Component {
    state = {
        active: false,
    }

    componentDidMount() {
        setTimeout(this.activate, 10);
    }

    componentWillUnmount() {
        this.setState({ active: false });
    }

    activate = () => {
        this.setState({ active: true });
    }

    render({
        title,
        children,
        onDanger,
        onSecondary,
        onPrimary,
        small,
    },{
        active,
    }) {
        const activeClass = active ? style.active : '';
        return (
            <div class={[style.overlay, activeClass].join(' ')}>
                <div class={[style.modal, activeClass, small ? style.small : ''].join(' ')}>
                    <h3 class={style.modalHeader}>{title}</h3>
                    <div class={style.modalContent}>
                        {children}
                    </div>
                </div>
            </div>
        );
    }
}
