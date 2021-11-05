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
import * as style from './fullscreen.css';

interface Props {
    width?: string;
    withBottomBar?: boolean;
}

export function Fullscreen({
    children,
    width,
    withBottomBar,
}: RenderableProps<Props>) {
    const styles = width ? { style: `width: ${width}` } : undefined;
    return (
        <div className={style.fullscreen}>
            <div className={style.inner} {...styles}>
                {children}
            </div>
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

interface FullscreenContentProps {
    fullWidth?: boolean;
}

export function FullscreenContent({
    children,
    fullWidth,
}: RenderableProps<FullscreenContentProps>) {
    const classes = fullWidth ? `${style.content} ${style.fullWidth}` : style.content;
    return (
        <div className={classes}>{children}</div>
    );
}

interface HeaderProps {
    small?: boolean;
    title: string;
    withAppLogo?: boolean;
}

export function FullscreenHeader({
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

export function FullscreenButtons({ children }) {
    return (
        <div className={style.buttons}>
            {children}
        </div>
    );
}
