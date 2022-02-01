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

import { PropsWithChildren } from 'react';
import { AppLogo } from '../icon';
import { Footer } from '../layout';
import { SwissMadeOpenSource } from '../icon/logo';
import { Checked, Close } from '../icon/icon';
import style from './view.module.css';

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
}: PropsWithChildren<ViewProps>) {
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
                <div style={{marginTop: 'auto'}}>
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
    textAlign?: 'center' | 'left';
    withIcon?: 'success';
}

export function ViewContent({
    children,
    fullWidth,
    textAlign,
    withIcon,
    ...props
}: PropsWithChildren<ViewContentProps>) {
    const align = textAlign ? style[`text-${textAlign}`] : '';
    const containerWidth = fullWidth ? style.fullWidth : '';
    const classes = `${style.content} ${containerWidth} ${align}`;
    return (
        <div className={classes} {...props}>
            {withIcon === 'success' && (
                <Checked className={style.largeIcon} />
            )}
            {children}
        </div>
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
}: PropsWithChildren<HeaderProps>) {
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

export function ViewButtons({ children }: PropsWithChildren<ViewButtonsProps>) {
    return (
        <div className={style.buttons}>
            {children}
        </div>
    );
}
