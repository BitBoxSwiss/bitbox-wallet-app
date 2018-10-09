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

import { Component, h } from 'preact';
import * as style from './dialog.css';

export default class Dialog extends Component {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
            currentTab: 0,
        };
    }

    componentDidMount() {
        setTimeout(this.activate, 10);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.controlKeys);
        this.setState({
            active: false,
            currentTab: 0,
        });
    }

    focusWithin = () => {
        this.focusableChildren = this.modalContent.querySelectorAll('a, button, input, textarea');
        for (let c of this.focusableChildren) {
            c.classList.add('tabbable');
        }
        document.addEventListener('keydown', this.controlKeys);
    }

    addTabIndex = currentTab => {
        let next = currentTab + 1;
        if (next >= this.focusableChildren.length) {
            next = 0;
        }
        this.setState({ currentTab: next });
    }

    subtractTabIndex = currentTab => {
        let previous = currentTab - 1;
        if (previous < 0) {
            previous = this.focusableChildren.length - 1;
        }
        this.setState({ currentTab: previous });
    }

    controlKeys = e => {
        const { currentTab } = this.state;
        const isTab = e.keyCode === 9;
        if (isTab) { e.preventDefault(); }
        if (isTab && e.shiftKey) {
            this.focusableChildren[currentTab].focus();
            this.subtractTabIndex(currentTab);
        } else if (isTab) {
            this.focusableChildren[currentTab].focus();
            this.addTabIndex(currentTab);
        }
    }

    activate = () => {
        this.setState({ active: true }, () => {
            this.focusWithin();
        });
    }

    render({
        title = null,
        small = false,
        children,
    },{
        active,
    }) {
        const activeClass = active ? style.active : '';
        return (
            <div class={[style.overlay, activeClass].join(' ')}>
                <div class={[style.modal, activeClass, small ? style.small : ''].join(' ')}>
                    {
                        title && (
                            <h3 class={style.modalHeader}>{title}</h3>
                        )
                    }
                    <div class={[style.modalContent, title ? '' : 'first'].join(' ')} ref={el => this.modalContent = el}>
                        {children}
                    </div>
                </div>
            </div>
        );
    }
}
