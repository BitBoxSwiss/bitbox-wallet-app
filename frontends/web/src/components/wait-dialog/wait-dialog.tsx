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

import { Component, h, JSX, toChildArray, RenderableProps } from 'preact';
import { translate, TranslateProps } from '../../decorators/translate';
import approve from '../../assets/icons/hold.png';
import reject from '../../assets/icons/tap.png';
import { animate } from '../../utils/animation';
import * as style from '../dialog/dialog.css';

interface WaitDialogProps {
    includeDefault?: boolean;
    prequel?: JSX.Element;
    title?: string;
    paired?: boolean;
    touchConfirm?: boolean;
}

type Props = WaitDialogProps & TranslateProps;

interface State {
    active: boolean;
}

class WaitDialog extends Component<Props, State> {
    private overlay?: HTMLDivElement;
    private modal?: HTMLDivElement;

    public readonly state: State = {
        active: false,
    }

    public componentWillMount() {
        document.body.addEventListener('keydown', this.handleKeyDown);
    }

    public componentDidMount() {
        setTimeout(this.activate, 10);
    }

    public componentWillUnmount() {
        document.body.removeEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        const activeElement = document.activeElement;
        if (activeElement && activeElement instanceof HTMLElement) {
            activeElement.blur();
        }
        e.preventDefault();
        e.stopPropagation();
    }

    private setOverlay = ref => {
        this.overlay = ref;
    }

    private setModal = ref => {
        this.modal = ref;
    }

    private activate = () => {
        this.setState({ active: true }, () => {
            if (!this.overlay || !this.modal) {
                return;
            }
            animate(this.overlay, 'fadeIn', () => {
                if (!this.overlay) {
                    return;
                }
                this.overlay.classList.add(style.activeOverlay);
            });
            animate(this.modal, 'fadeInUp', () => {
                if (!this.modal) {
                    return;
                }
                this.modal.classList.add(style.activeModal);
            });
        });
    }

    public render({
        t,
        includeDefault,
        prequel,
        title,
        paired = false,
        touchConfirm = true,
        children,
    }: RenderableProps<Props>,
    {}: State) {
        const defaultContent = (
            <div>
                {
                    prequel && (
                        <p className="m-top-none">{prequel}</p>
                    )
                }
                {
                    paired ? (
                        <div>
                            <p class={[style.confirmationLabel, touchConfirm && paired ? style.disabledLabel : '', 'm-top-none'].join(' ')}>
                                <span class={style.confirmationLabelNumber}>1.</span>
                                {t('confirm.infoWhenPaired')}
                            </p>
                            <p class={[style.confirmationLabel, !touchConfirm && paired ? style.disabledLabel : ''].join(' ')}>
                                <span class={style.confirmationLabelNumber}>2.</span>
                                {t('confirm.info')}
                            </p>
                        </div>
                    ) : (
                        <p class={[style.confirmationLabel, style.noStep, 'm-top-none'].join(' ')}>
                            {t('confirm.info')}
                        </p>
                    )
                }
                {
                    touchConfirm && (
                        <div class={['flex flex-row flex-between flex-items-stretch', style.confirmationInstructions].join(' ')}>
                            <div class="flex flex-column flex-center flex-items-center">
                                <img class={style.image} src={reject} alt="Reject" />
                                <p>
                                    {t('confirm.abortInfo')}
                                    <span class="text-red">{t('confirm.abortInfoRedText')}</span>
                                </p>
                            </div>
                            <div class="flex flex-column flex-center flex-items-center">
                                <img class={style.image} src={approve} alt="Approve" />
                                <p>
                                    {t('confirm.approveInfo')}
                                    <span class="text-green">{t('confirm.approveInfoGreenText')}</span>
                                </p>
                            </div>
                        </div>
                    )
                }
            </div>
        );

        const hasChildren = toChildArray(children).length > 0;
        return (
            <div
                className={style.overlay}
                ref={this.setOverlay}
                style="z-index: 10001;">
                <div className={style.modal} ref={this.setModal}>
                    {
                        title && (
                            <div className={style.header}>
                                <h3 className={style.title}>{title}</h3>
                            </div>
                        )
                    }
                    <div className={style.contentContainer}>
                        <div className={style.content}>
                            { (hasChildren && includeDefault) ? defaultContent : null }
                            { hasChildren ? (
                                <div class="flex flex-column flex-start">
                                    {children}
                                </div>
                            ) : defaultContent }
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const TranslatedWaitDialog = translate<WaitDialogProps>()(WaitDialog);
export { TranslatedWaitDialog as WaitDialog };
