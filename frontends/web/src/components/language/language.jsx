import { Component } from 'preact';
import { translate } from 'react-i18next';
// import { Button } from '../forms';
// import Dialog from '../dialog/dialog';
// import style from './language.css';

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
    }) {
        return; // TODO: remove when we have more languages.
        /*
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
                        <Dialog small title={t('language.title')}>
                            {
                                this.languages.map((language, i) => {
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
        */
    }
}
