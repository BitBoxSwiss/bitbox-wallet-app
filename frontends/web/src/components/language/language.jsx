import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../forms';
import style from './language.css';

@translate()
export default class LanguageSwitcher extends Component {
    constructor(props) {
        super(props);
        this.languages = [
            { code: 'en', display: 'English' },
            { code: 'de', display: 'Deutsch' },
        ];
        const inverse = {};
        this.languages.forEach((obj, index) => {
            inverse[obj.code] = index;
        });
        this.state = {
            selectedIndex: inverse[props.i18n.language] || 0,
            activeDialog: false,
        };
    }

    changeLanguage = ({ target }) => {
        const langCode = target.dataset.code;
        const index = parseInt(target.dataset.index);
        this.setState({ selectedIndex: index });
        this.context.i18n.changeLanguage(langCode);
    }

    render({
        t,
        i18n,
    }, {
        selectedIndex,
        activeDialog,
    }) {
        return (
            <div class={style.languageSelect}>
                <Button
                    type="button"
                    transparent
                    onClick={() => this.setState({ activeDialog: true })}>
                    {this.languages[selectedIndex].display}
                </Button>
                {
                    activeDialog && (
                        <div class={['overlay', activeDialog ? 'active' : ''].join(' ')}>
                            <div class={['modal', 'small', activeDialog ? 'active' : ''].join(' ')}>
                                <h3 class="modalHeader text-center">{t('language.title')}</h3>
                                <div class="modalContent rows">
                                    {
                                        this.languages.map((language, i) => {
                                            const selected = selectedIndex === i;
                                            return (
                                                <button
                                                    class={[style.language, selected ? style.selected : ''].join(' ')}
                                                    onClick={this.changeLanguage}
                                                    data-index={i}
                                                    data-code={language.code}>
                                                    {language.display}
                                                </button>
                                            );
                                        })
                                    }
                                    <div class="row extra flex flex-row flex-end">
                                        <Button primary onClick={() => this.setState({ activeDialog: false })}>Done</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>
        );
    }
}
