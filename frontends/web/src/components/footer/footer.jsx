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

import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet } from '../../utils/request';
import LanguageSwitch from '../language/language';
import style from './footer.css';

@translate()
export default class Footer extends Component {
    state = {
        version: null,
    }

    componentDidMount() {
        apiGet('version').then(version => this.setState({ version }));
    }

    render({
        t,
        bottomSpace,
        children
    }, {
        version,
    }) {
        return (
            <footer class={[style.footer, 'flex flex-row flex-items-center flex-end', bottomSpace ? style.bottomSpace : ''].join(' ')}>
                {children}
                {version && (<p>{t('footer.appVersion')} {version}</p>)}
                <LanguageSwitch />
            </footer>
        );
    }
}
