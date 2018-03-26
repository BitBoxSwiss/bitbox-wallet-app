import { Component } from 'preact';
import { Link } from 'preact-router/match';
import { translate } from 'react-i18next';

import { apiPost } from '../../utils/request';
import Logo from '../icon/logo';

import settings from '../../assets/icons/settings.svg';
import ejectIcon from '../../assets/icons/eject.svg';

function Sidebar({ accounts, t, activeWallet }) {
  // console.table(accounts)
  return (
    <nav className="sidebar">
      <ClipPath />
      {accounts.map(getWalletLink)}
      <div className="sidebar_drawer"></div>
      <div className="sidebar_bottom">
        {process.env.NODE_ENV === 'development' ?
        <a href="#" onClick={ (e) => {
          apiPost("devices/test/deregister");
          e.preventDefault();
        } }>
          <img className="sidebar_settings" src={ejectIcon} />
          <span className="sidebar_label">{ t("sidebar.leave") }</span>
        </a>
        : null}

        <Link activeClassName="sidebar-active" href="/settings/" title={ t("sidebar.settings") }>
          <img className="sidebar_settings" src={settings} alt={ t("sidebar.settings") } />
          <span className="sidebar_label">{ t("sidebar.settings") }</span>
        </Link>
      </div>
    </nav>
  );
}

function getWalletLink({code, name}) {
  return (
    <Link key={code} activeClassName="sidebar-active" href={`/account/${code}`} title={name}>
      <Logo code={code} className="sidebar_icon" alt={name} />
      <span className="sidebar_label">{name}</span>
    </Link>
  );
}

function ClipPath() {
  return (
    <svg height="0" width="0">
      <defs>
        <clipPath id="cross">
          <rect y="0" x="0" width="16" height="40" rx="8" ry="8" />
        </clipPath>
      </defs>
    </svg>
  );
}

export default translate(['app'])(Sidebar);
