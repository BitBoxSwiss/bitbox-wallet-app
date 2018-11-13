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

import { /* i18nEditorActive, */ extraLanguage } from '../../i18n/i18n';
import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../forms';
import { Dialog } from '../dialog/dialog';
import globe from '../../assets/icons/globe.svg';
import * as style from './language.css';

@translate()
export default class LanguageSwitcher extends Component {
    constructor(props) {
        super(props);
        const languages = [
            { code: 'en', display: 'English' },
            { code: 'ja', display: '日本語' },
        ];
        if (extraLanguage) {
            languages.push({
                code: extraLanguage,
                display: extraLanguage,
            });
        }
        this.state = {
            selectedIndex: this.getSelectedIndex(languages),
            activeDialog: false,
            languages,
        };
    }

    abort = () => {
        this.setState({ activeDialog: false });
    }

    getSelectedIndex = (languages) => {
        const index = languages.findIndex(({ code }) => code === this.props.i18n.language);
        if (index === -1) {
            return 0;
        }
        return index;
    }

    componentWillMount() {

        /* if (i18nEditorActive) {
         *     // Get languages from backend instead when translating,
         *     // as new languages won't be shown otherwise.
         *     this.context.
         *         i18n.
         *         services.
         *         backendConnector.
         *         backend.
         *         getLanguages((err, data) => {
         *             if (err) {
         *                 alert(err);
         *                 return;
         *             }
         *             const languages = Object.entries(data).map(([key, value]) => {
         *                 return {
         *                     code: key,
         *                     display: value.nativeName,
         *                 };
         *             });
         *             this.setState({ languages, selectedIndex: this.getSelectedIndex(languages) });
         *         });
         * } */
    }

    changeLanguage = ({ target }) => {
        const langCode = target.dataset.code;
        const index = parseInt(target.dataset.index, 10);
        this.setState({
            selectedIndex: index,
            activeDialog: false,
        });
        this.context.i18n.changeLanguage(langCode);
    }

    render({
        t,
    }, {
        selectedIndex,
        activeDialog,
        languages,
    }) {
        if (languages.length === 1) {
            return null;
        }
        return (
            <div>
                <Button
                    type="button"
                    transparent
                    className={[style.button, 'flex flex-row flex-items-center'].join(' ')}
                    onClick={() => this.setState({ activeDialog: true })}>
                    <img src={globe} />
                    {languages[selectedIndex].display}
                </Button>
                {
                    activeDialog && (
                        <Dialog small title={t('language.title')} onClose={this.abort}>
                            {
                                languages.map((language, i) => {
                                    const selected = selectedIndex === i;
                                    return (
                                        <button
                                            key={language.code}
                                            class={[style.language, selected ? style.selected : ''].join(' ')}
                                            onClick={this.changeLanguage}
                                            data-index={i}
                                            data-code={language.code}>
                                            {language.display}
                                        </button>
                                    );
                                })
                            }
                        </Dialog>
                    )
                }
            </div>
        );
    }
}
