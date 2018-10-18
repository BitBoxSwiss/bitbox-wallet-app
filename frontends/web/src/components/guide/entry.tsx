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

/**
 * Typically manually written as a child of the guide component.
 */
interface ExplicitEntryProps {
    title: string;
    shown?: boolean;
    highlighted?: boolean;
}

export interface ImplicitEntry extends ExplicitEntryProps {
    text: string;
    link?: {
        url: string;
        text: string;
    };
}

/**
 * Typically coming from the language file and inserted by the guide component.
 */
interface ImplicitEntryProps {
    entry: ImplicitEntry;
}

type Props = ExplicitEntryProps | ImplicitEntryProps;

function isExplicitEntryProps(props: Props): props is ExplicitEntryProps {
    return (props as ExplicitEntryProps).title !== undefined;
}

function isImplicitEntryProps(props: Props): props is ImplicitEntryProps {
    return (props as ImplicitEntryProps).entry !== undefined;
}

interface State {
    shown: boolean;
    highlighted: boolean;
}

export class Entry extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            shown: isExplicitEntryProps(props) && (props.shown || props.highlighted) || isImplicitEntryProps(props) && (props.entry.shown || props.entry.highlighted) || false,
            highlighted: isExplicitEntryProps(props) && props.highlighted || isImplicitEntryProps(props) && props.entry.highlighted || false,
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
                        <h2>
                            {isExplicitEntryProps(props) ? props.title : ''}
                            {isImplicitEntryProps(props) ? props.entry.title : ''}
                        </h2>
                    </div>
                </div>
                <div class={[style.entryContent, shown ? style.expanded : ''].join(' ')}>
                    {shown ? (
                        <div class="flex-1">
                            {isImplicitEntryProps(props) && props.entry.text.trim().split('\n').map(p => <p key={p}>{p}</p>)}
                            {isImplicitEntryProps(props) && props.entry.link && (
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
