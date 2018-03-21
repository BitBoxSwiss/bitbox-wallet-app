import { Component } from 'preact';
import { Link } from 'preact-router/match';
import style from './style';

import { translate } from 'react-i18next';

import LanguageSwitcher from '../language-switcher';

import { apiGet, apiPost } from '../../util';

@translate()
export default class Header extends Component {
    constructor(props) {
        super(props);

        this.state = { version: "", emulated: false };
    }

    componentDidMount() {
        apiGet("version").then(result => this.setState({ version: result }));
        apiGet("device/info").then(({ name }) => this.setState({ emulated: name == "Emulated BitBox" }));
    }

    render({ t }, { version, emulated }) {
        function renderNav() {
            if (emulated) {
                return <nav>
                    <Link activeClassName={style.active} href="/">{ t("header.wallet") }</Link>
                    <a href="#" onClick={ () => apiPost("devices/test/deregister") }>{ t("header.leave") }</a>
                </nav>;
            } else {
                return <nav>
                    <Link activeClassName={style.active} href="/">{ t("header.wallet") }</Link>
                    <Link activeClassName={style.active} href="/options/">{ t("header.options") }</Link>
                    <Link activeClassName={style.active} href="/manage-backups/">{ t("header.manageBackups") }</Link>
                </nav>;
            }
        }

        return (
            <header class={style.header}>
                <h1>BitBox</h1>
                { renderNav() }
                <span class={style.languageSwitcher}><LanguageSwitcher/></span>
                <span class={style.version}>Version: {version}</span>
            </header>
        );
    }
}
