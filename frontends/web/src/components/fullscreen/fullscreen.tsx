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
import * as style from './fullscreen.css';

interface Props {
    width?: number;
}

export function Fullscreen({
    children,
    width = 480,
}: RenderableProps<Props>) {
    return (
        <div className={style.fullscreen}>
            <div className={style.inner} style={`width: ${width}px;`}>
                {children}
            </div>
        </div>
    );
}

export function FullscreenContent({ children }: RenderableProps<{}>) {
    return (
        <div className={style.content}>{children}</div>
    );
}

interface HeaderProps {
    title: string;
}

export function FullscreenHeader(props: RenderableProps<HeaderProps>) {
    return (
        <header className={style.header}>
            <h1 className={style.title}>{props.title}</h1>
            {props.children}
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
