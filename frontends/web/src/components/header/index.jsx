import { Component } from 'preact';
import { Link } from 'preact-router/match';
import style from './style';

import { translate } from 'react-i18next';

import LanguageSwitcher from '../language-switcher';

@translate()
export default class Header extends Component {
    render({t}) {
        return (
            <header class={style.header}>
              <h1>DBB</h1>
              <nav>
                <Link activeClassName={style.active} href="/">{t("header.wallet")}</Link>
                <Link activeClassName={style.active} href="/options/">{t("header.options")}</Link>
                <Link activeClassName={style.active} href="/manage-backups/">{t("header.manageBackups")}</Link>
              </nav>
              <span class={style.languageSwitcher}><LanguageSwitcher/></span>
            </header>
        );
    }
}
