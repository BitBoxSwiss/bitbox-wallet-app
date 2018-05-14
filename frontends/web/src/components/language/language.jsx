import { Component } from 'preact';
import { translate } from 'react-i18next';
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
    };
  }

  changeLanguage = ({ target }) => {
    const index = parseInt(target.selectedOptions[0].dataset.index);
    this.setState({ selectedIndex: index });
    this.context.i18n.changeLanguage(target.value);
  }

  render({ t, i18n }, { selectedIndex }) {
    return (
      <div class={style.languageSelect}>
        <div class={style.caret}>&#9660;</div>
        <select
          ref={selectBox => this.selectBox = selectBox}
          onChange={this.changeLanguage}>
          {
            this.languages.map((lang, i) => {
              const selected = selectedIndex === i;
              return (
                <option selected={selected} value={lang.code} data-index={i}>{lang.display}</option>
              );
            })
          }
        </select>
      </div>
    );
  }
}
