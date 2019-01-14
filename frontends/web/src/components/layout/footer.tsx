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
import { translate, TranslateProps } from '../../decorators/translate';
import { apiGet } from '../../utils/request';
import LanguageSwitch from '../language/language';
import * as style from './footer.css';

interface State {
    version: string | null;
}

class Footer extends Component<TranslateProps, State> {
    constructor(props) {
        super(props);
        this.state = {
            version: null,
        };
    }

    public componentDidMount() {
        apiGet('version').then(version => this.setState({ version }));
    }

    public render(
        { t, children }: RenderableProps<TranslateProps>,
        { version }: State,
    ) {
        return (
            <footer class={[style.footer, 'flex flex-row flex-items-center flex-end'].join(' ')}>
                {children}
                {version && (<p>{t('footer.appVersion')} {version}</p>)}
                <LanguageSwitch />
            </footer>
        );
    }
}

const TranslatedFooter = translate()(Footer);
export { TranslatedFooter as Footer };
