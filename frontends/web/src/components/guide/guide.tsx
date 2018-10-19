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

import i18n from 'i18next';
import { h, RenderableProps } from 'preact';
import { share } from '../../decorators/share';
import { Store } from '../../decorators/store';
import { translate, TranslateProp } from '../../decorators/translate';
import { setConfig } from '../../utils/config';
import { apiGet } from '../../utils/request';
import A from '../anchor/anchor';
import { Entry, EntryProp } from './entry';
import * as style from './guide.css';

interface SharedProps {
    shown: boolean;
}

export const store = new Store<SharedProps>({ shown: false });

apiGet('config').then(({ frontend }) => {
    if (frontend && frontend.guideShown != null) { // eslint-disable-line eqeqeq
        store.setState({ shown: frontend.guideShown });
    } else {
        store.setState({ shown: true });
    }
});

function setShown(shown: boolean) {
    store.setState({ shown });
    setConfig({ frontend: { guideShown: shown } });
}

export function toggle() {
    setShown(!store.state.shown);
}

export function show() {
    setShown(true);
}

export function hide() {
    setShown(false);
}

interface ProvidedProps {
    screen?: string;
}

type Props = ProvidedProps & SharedProps & TranslateProp;

// Guide entries are fetched from the translation files. Manual fallback to the reference language
// is implemented in case an array element is undefined in the current language (can be null if not
// translated in order, for example).
function getGuideEntries(t, screen): EntryProp[] {
    const key = 'guide.' + screen;
    // For now, fallback to the main fallback language, not cascading.
    const entriesFallbackLanguage = i18n.getFixedT(i18n.languages[i18n.languages.length - 1])(key, { defaultValue: [] });
    // cimode returns the translation keys directly to make them visible to translators. In case of
    // arrays/nested objects, we manually map the children to keys, so that the translator can also see the subkeys.
    if (i18n.language === 'cimode') {
        return entriesFallbackLanguage.map((entry, index) => {
            const keyPrefix = key + '.' + index.toString();
            return {
                title: keyPrefix + '.title',
                text: keyPrefix + '.text',
                link: entry.link ? {
                    url: keyPrefix + '.link',
                    text: keyPrefix + '.text',
                } : null,
            };
        });
    }
    const entriesCurrentLanguage = t(key, { defaultValue: [] });
    return entriesFallbackLanguage.map((entry, index) => entriesCurrentLanguage[index] || entry);
}

function Guide({ screen, shown, t, children }: RenderableProps<Props>): JSX.Element {
    return (
        <div className={style.wrapper}>
            <div className={[style.guide, shown && style.show].join(' ')}>
                <div className={[style.header, 'flex flex-row flex-between flex-items-center'].join(' ')}>
                    <h1>{t('guide.title')}</h1>
                </div>
                {screen && getGuideEntries(t, screen).map((entry: EntryProp, i: number) => (
                    <Entry key={screen + i} entry={entry} />
                ))}
                {children}
                <div className={style.entry}>
                    {t('guide.appendix.text')} <A href={t('guide.appendix.href')}>{t('guide.appendix.link')}</A>
                </div>
            </div>
        </div>
    );
}

const HOC = translate<ProvidedProps>()(share<SharedProps, ProvidedProps & TranslateProp>(store)(Guide));

export { HOC as Guide };
