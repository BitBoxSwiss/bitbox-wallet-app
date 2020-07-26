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

import { Component, h, RenderableProps } from 'preact';
import { animate } from '../../utils/animation';
import * as style from './dialog.css';

interface Props {
    title?: string;
    small?: boolean;
    medium?: boolean;
    large?: boolean;
    slim?: boolean;
    centered?: boolean;
    disableEscape?: boolean;
    onClose?: (e?: Event) => void;
    disabledClose?: boolean;
}

interface State {
    active: boolean;
    currentTab: number;
}

class Dialog extends Component<Props, State> {
    private overlay!: HTMLElement;
    private modal!: HTMLElement;
    private modalContent!: HTMLElement;
    private focusableChildren!: NodeListOf<HTMLElement>;

    constructor(props: Props) {
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
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private setOverlay = (element: HTMLDivElement) => {
        this.overlay = element;
    }

    private setModal = (element: HTMLDivElement) => {
        this.modal = element;
    }

    private setModalContent = (element: HTMLDivElement) => {
        this.modalContent = element;
    }

    private handleFocus = (e: FocusEvent) => {
        const input = e.target as HTMLElement;
        const index = input.getAttribute('index');
        this.setState({ currentTab: Number(index) });
    }

    private focusWithin = () => {
        this.focusableChildren = this.modalContent.querySelectorAll('a, button, input, textarea');
        const focusables = Array.from(this.focusableChildren);
        for (const c of focusables) {
            c.classList.add('tabbable');
            c.setAttribute('index', focusables.indexOf(c).toString());
            c.addEventListener('focus', this.handleFocus);
        }
        document.addEventListener('keydown', this.handleKeyDown);
    }

    private focusFirst = () => {
        const focusables = this.focusableChildren;
        if (focusables.length && focusables[0].getAttribute('autofocus') !== 'false') {
            focusables[0].focus();
        }
    }

    private updateIndex = (isNext: boolean) => {
        const target = this.getNextIndex(isNext);
        this.setState({ currentTab: target }, () => {
            this.focusableChildren[target].focus();
        });
    }

    private getNextIndex(isNext: boolean) {
        const { currentTab } = this.state;
        const focusables = Array.from(this.focusableChildren);
        const arr = isNext ? focusables : focusables.reverse();
        const current = isNext ? currentTab : (arr.length - 1) - currentTab;
        let next = isNext ? currentTab + 1 : arr.length - currentTab;
        next = arr.findIndex((item, i) => (i >= next && !item.hasAttribute('disabled')));
        next = next < 0 ? arr.findIndex((item, i) => (i <= current && !item.hasAttribute('disabled'))) : next;
        return isNext ? next : (arr.length - 1) - next;
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        const { disableEscape } = this.props;
        const isEsc = e.keyCode === 27;
        const isTab = e.keyCode === 9;
        if (!disableEscape && isEsc) {
            this.deactivate();
        } else if (isTab) {
            e.preventDefault();
        }
        if (isTab && e.shiftKey) {
            this.updateIndex(false);
        } else if (isTab) {
            this.updateIndex(true);
        }
    }

    private deactivate = () => {
        animate(this.modal, 'fadeOutUp', () => {
            this.modal.classList.remove(style.activeModal);
            this.setState({ active: false, currentTab: 0 }, () => {
                document.removeEventListener('keydown', this.handleKeyDown);
                if (this.props.onClose) {
                    this.props.onClose();
                }
            });
        });
        animate(this.overlay, 'fadeOut', () => {
            this.overlay.classList.remove(style.activeOverlay);
        });
    }

    private activate = () => {
        this.setState({ active: true }, () => {
            animate(this.overlay, 'fadeIn', () => {
                this.overlay.classList.add(style.activeOverlay);
            });
            animate(this.modal, 'fadeInUp', () => {
                this.modal.classList.add(style.activeModal);
                this.focusWithin();
                this.focusFirst();
            });
        });
    }

    public render(
        {
            title,
            small,
            medium,
            large,
            slim,
            centered,
            onClose,
            disabledClose,
            children,
        }: RenderableProps<Props>,
        {}: State,
    ) {
        const isSmall = small ? style.small : '';
        const isMedium = medium ? style.medium : '';
        const isLarge = large ? style.large : '';
        const isSlim = slim ? style.slim : '';
        const isCentered = centered && !onClose ? style.centered : '';
        return (
            <div className={[style.overlay].join(' ')} ref={this.setOverlay}>
                <div className={[style.modal, isSmall, isMedium, isLarge].join(' ')} ref={this.setModal}>
                    {
                        title && (
                            <div className={[style.header, isCentered].join(' ')}>
                                <h3 class={style.title}>{title}</h3>
                                {
                                    onClose && (
                                        <button className={style.closeButton} onClick={this.deactivate} disabled={disabledClose}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </svg>
                                        </button>
                                    )
                                }
                            </div>
                        )
                    }
                    <div className={[style.contentContainer, isSlim].join(' ')} ref={this.setModalContent}>
                        <div className={style.content}>
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export { Dialog };
