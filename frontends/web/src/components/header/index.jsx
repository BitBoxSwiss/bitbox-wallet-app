import { Component } from 'preact';
import { Link } from 'preact-router/match';
import style from './style';

export default class Header extends Component {
    render() {
        return (
            <header class={style.header}>
              <h1>DBB</h1>
              <nav>
                <Link activeClassName={style.active} href="/">Wallet</Link>
                <Link activeClassName={style.active} href="/options/">Options</Link>
                <Link activeClassName={style.active} href="/manage-backups/">Manage Backups</Link>
              </nav>
            </header>
        );
    }
}
