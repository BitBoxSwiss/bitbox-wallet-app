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
import A from '../anchor/anchor';
import * as style from './guide.css';

export interface EntryProp {
    title: string;
    text: string;
    link?: {
        url: string;
        text: string;
    };
}

interface EntryProps {
    entry: EntryProp;
    shown?: boolean;
    highlighted?: boolean;
}

type Props = EntryProps;

interface State {
    shown: boolean;
    highlighted: boolean;
}

export class Entry extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            shown: props.shown || props.highlighted || false,
            highlighted: props.highlighted || false,
        };
    }

    private toggle = () => {
        this.setState((state: State): State => ({
            shown: !state.shown,
            highlighted: false,
        }));
    }

    public render(props: RenderableProps<Props>, {
        shown,
        highlighted,
    }: Readonly<State>) {
        return (
            <div className={highlighted ? style.highlighted : style.entry}>
                <div class={style.entryTitle} onClick={this.toggle}>
                    <div class={style.entryToggle}>{shown ? '–' : '+'}</div>
                    <div class={style.entryTitleText}>
                        <h2>{props.entry.title}</h2>
                    </div>
                </div>
                <div class={[style.entryContent, shown ? style.expanded : ''].join(' ')}>
                    {shown ? (
                        <div class="flex-1">
                            {props.entry.text.trim().split('\n').map(p => <p key={p}>{p}</p>)}
                            {props.entry.link && (
                                <p><A href={props.entry.link.url}>{props.entry.link.text}</A></p>
                            )}
                            {props.children}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }
}
