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
        children
    }, {
        version,
    }) {
        return (
            <footer class={[style.footer, 'flex flex-row flex-items-center flex-end'].join(' ')}>
                {children}
                {version && (<p>{t('footer.appVersion')} {version}</p>)}
                <LanguageSwitch />
            </footer>
        );
    }
}
