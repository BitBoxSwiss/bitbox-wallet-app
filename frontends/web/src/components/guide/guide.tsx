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
import { share } from '../../decorators/share';
import { Store } from '../../decorators/store';
import { translate, TranslateProps } from '../../decorators/translate';
import { setConfig } from '../../utils/config';
import { apiGet } from '../../utils/request';
import A from '../anchor/anchor';
import * as style from './guide.css';

interface SharedProps {
    shown: boolean;
    showable: boolean;
}

export const store = new Store<SharedProps>({
    shown: false,
    showable: false,
});

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

type Props = SharedProps & TranslateProps;

class Guide extends Component<Props, {}> {
    public componentDidMount() {
        store.setState({ showable: true });
    }

    public componentWillUnmount() {
        store.setState({ showable: false });
    }

    public render(
        { shown, t, children }: RenderableProps<Props>,
    ) {
        return (
            <div className={style.wrapper}>
                <div className={[style.guide, shown && style.show].join(' ')}>
                    <div className={[style.header, 'flex flex-row flex-between flex-items-center'].join(' ')}>
                        <h1>{t('guide.title')}</h1>
                    </div>
                    {children}
                    <div className={style.entry}>
                        {t('guide.appendix.text')} <A href={t('guide.appendix.href')}>{t('guide.appendix.link')}</A>
                    </div>
                </div>
            </div>
        );
    }
}

const HOC = translate()(share<SharedProps, TranslateProps>(store)(Guide));

export { HOC as Guide };
