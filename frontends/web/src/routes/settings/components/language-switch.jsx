import {Component} from 'preact';

import Select from 'preact-material-components/Select';
import 'preact-material-components/List/style.css';
import 'preact-material-components/Menu/style.css';
import 'preact-material-components/Select/style.css';

import { translate } from 'react-i18next';

@translate()
export default class LanguageSwitcher extends Component {
    constructor(props) {
        super(props);
        this.languages = [
            { code: 'en', display: 'English' },
            { code: 'de', display: 'Deutsch' }
        ];
        const inverse = {};
        this.languages.forEach((obj, index) => {
            inverse[obj.code] = index;
        });
        this.state = {
            selectedIndex: inverse[props.i18n.language] || 0
        };
    }

    render({ t, i18n }, { selectedIndex }) {
        return (
            <span>
                <Select
                    selectedIndex={selectedIndex}
                    onChange={(e) => {
                        this.setState({ selectedIndex: e.selectedIndex });
                        i18n.changeLanguage(this.languages[e.selectedIndex].code);
                    }}
                >
                    { this.languages.map(lang => (<Select.Item>{ lang.display }</Select.Item>)) }
                </Select>
            </span>
        );
    }
}
