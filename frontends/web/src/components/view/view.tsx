/**
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

import { h, RenderableProps } from 'preact';
import { AppLogo } from '../icon';
import { Footer } from '../layout';
import { SwissMadeOpenSource } from '../icon/logo';
import { Close } from '../icon/icon';
import * as style from './view.module.css';

type ViewProps = {
    fullscreen?: boolean;
    minHeight?: string;
    top?: boolean;
    onClose?: () => void;
    position?: 'fill' | '';
    textCenter?: boolean;
    width?: string;
    withBottomBar?: boolean;
}

export function View({
    fullscreen,
    top = false,
    children,
    minHeight,
    onClose,
    textCenter,
    width,
    withBottomBar,
}: RenderableProps<ViewProps>) {
    let classNames = style.inner;
    if (!top) {
        classNames += ` ${style.center}`;
    }
    if (textCenter) {
        classNames += ` ${style.textCenter}`;
    }
    const inlineStyles = {
        ...(minHeight && { minHeight }),
        ...(width && { width }),
    };
    return (
        <div className={fullscreen ? style.fullscreen : style.fill}>
            <div
                className={classNames}
                style={inlineStyles}>
                {children}
            </div>
            {onClose && (
                <button className={style.closeButton} onClick={onClose}>
                    <Close />
                </button>
            )}
            {withBottomBar && (
                <div style="margin-top: auto;">
                    <Footer>
                        <SwissMadeOpenSource />
                    </Footer>
                </div>
            )}
        </div>
    );
}

type ViewContentProps = {
    fullWidth?: boolean;
}

export function ViewContent({
    children,
    fullWidth,
    ...props
}: RenderableProps<ViewContentProps>) {
    const classes = `${style.content} ${fullWidth ? style.fullWidth : ''}`;
    return (
        <div className={classes} {...props}>{children}</div>
    );
}

type HeaderProps = {
    small?: boolean;
    title: string;
    withAppLogo?: boolean;
}

export function ViewHeader({
    children,
    small,
    title,
    withAppLogo,
}: RenderableProps<HeaderProps>) {
    const headerStyles = small ? `${style.header} ${style.smallHeader}` : style.header;
    return (
        <header className={headerStyles}>
            {withAppLogo && <AppLogo />}
            <h1 className={style.title}>{title}</h1>
            {children}
        </header>
    );
}

type ViewButtonsProps = {}

export function ViewButtons({ children }: RenderableProps<ViewButtonsProps>) {
    return (
        <div className={style.buttons}>
            {children}
        </div>
    );
}
