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

interface Props {
    children: JSX.Element[] | JSX.Element;
    title?: string;
    small?: boolean;
    disableEscape?: boolean;
    onClose: (e: any) => void;
}

interface State {
    active: boolean;
    currentTab: number;
}

class Dialog extends Component<Props, State> {
    private modalContent!: HTMLElement;
    private focusableChildren!: NodeListOf<HTMLElement>;

    constructor(props) {
        super(props);
        this.state = {
            active: false,
            currentTab: 0,
        };
    }

    public componentDidMount() {
        setTimeout(this.activate, 10);
    }

    public componentWillUnmount() {
        this.deactivate();
    }

    private setModalContent = element => {
        this.modalContent = element;
    }

    private focusWithin = () => {
        this.focusableChildren = this.modalContent.querySelectorAll('a, button, input, textarea');
        for (const c of this.focusableChildren) {
            c.classList.add('tabbable');
        }
        document.addEventListener('keydown', this.controlKeys);
    }

    private addTabIndex = currentTab => {
        let next = currentTab + 1;
        if (next >= this.focusableChildren.length) {
            next = 0;
        }
        this.setState({ currentTab: next });
    }

    private subtractTabIndex = currentTab => {
        let previous = currentTab - 1;
        if (previous < 0) {
            previous = this.focusableChildren.length - 1;
        }
        this.setState({ currentTab: previous });
    }

    private controlKeys = e => {
        const { currentTab } = this.state;
        const { disableEscape, onClose } = this.props;
        const focusables = this.focusableChildren;
        const isEsc = e.keyCode === 27;
        const isTab = e.keyCode === 9;
        if (!disableEscape && isEsc) {
            if (onClose) {
                onClose(e);
            }
        } else if (isTab) {
            e.preventDefault();
        }
        if (isTab && e.shiftKey) {
            focusables[currentTab].focus();
            this.subtractTabIndex(currentTab);
        } else if (isTab) {
            focusables[currentTab].focus();
            this.addTabIndex(currentTab);
        }
    }

    private deactivate = () => {
        this.setState({
            active: false,
            currentTab: 0,
        });
        document.removeEventListener('keydown', this.controlKeys);
    }

    private activate = () => {
        this.setState({ active: true }, () => {
            this.focusWithin();
        });
    }

    public render({ title, small, children, onClose }, { active, currentTab }) {
        const activeClass = active ? style.active : '';
        return (
            <div class={[style.overlay, activeClass].join(' ')}>
                <div class={[style.modal, activeClass, small ? style.small : ''].join(' ')}>
                    {
                        title && (
                            <h3 class={style.modalHeader}>{title}</h3>
                        )
                    }
                    <div class={[style.modalContent, title ? '' : 'first'].join(' ')} ref={this.setModalContent}>
                        {children}
                    </div>
                </div>
            </div>
        );
    }
}

export default Dialog;
