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
import i18n from '../../i18n/i18n';
import A from '../../components/anchor/anchor';
import style from './guide.css';

export function Guide({ guide, screen, children }) {
    return (
        <div className={style.wrapper}>
            <div className={[style.guide, guide.shown && style.show].join(' ')}>
                <div class={['flex flex-row flex-between', style.title].join(' ')}>
                    <h1>{i18n.t('guide.title')}</h1>
                    <button className={style.closeButton} onClick={guide.hide}>✕</button>
                </div>
                {screen && i18n.t('guide.' + screen, { defaultValue: [] }).map((entry, i) => (
                    <Entry key={screen + i} entry={entry} />
                ))}
                {children}
                <div className={style.entry}>
                    {i18n.t('guide.appendix.text')} <A href={i18n.t('guide.appendix.href')}>{i18n.t('guide.appendix.link')}</A>
                </div>
            </div>
        </div>
    );
}

export class Entry extends Component {
    constructor(props) {
        super(props);
        this.state = {
            shown: props.shown || props.highlighted || (props.entry && props.entry.shown),
            highlighted: props.highlighted || (props.entry && props.entry.highlighted),
        };
    }

    toggle = () => {
        this.setState(state => ({
            shown: !state.shown,
            highlighted: false,
        }));
    }

    render({
        title,
        entry,
        children,
    }, {
        shown,
        highlighted,
    }) {
        return (
            <div className={highlighted ? style.highlighted : style.entry}>
                <div class={style.entryTitle} onClick={this.toggle}>
                    <div class={style.entryToggle}>{shown ? '–' : '+'}</div>
                    <div class={style.entryTitleText}>
                        <h2>
                            {title || (entry && entry.title)}
                        </h2>
                    </div>
                </div>
                <div class={[style.entryContent, shown ? style.expanded : ''].join(' ')}>
                    {shown && (
                        <div class="flex-1">
                            {entry && entry.text.map(p => <p key={p}>{p}</p>)}
                            {entry && entry.link && (
                                <p><A href={entry.link.url}>{entry.link.text}</A></p>
                            )}
                            {children}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}
