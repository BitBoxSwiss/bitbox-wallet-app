import { Component } from 'preact';
import { Router } from 'preact-router';
import Header from './components/header/header';
import Wallets from './routes/wallet/wallet';
import Settings from './routes/settings/settings';
import ManageBackups from './routes/device/manage-backups/manage-backups';

import style from './components/style';

export default class Routes extends Component {
    constructor(props) {
        super(props);
    }

    render({ registerOnWalletEvent }) {
        return (
            <div class={style.container}>
              <Header/>
              <Router onChange={this.handleRoute}>
                <Wallets
                  path="/"
                  registerOnWalletEvent={registerOnWalletEvent}
                  />
                <Settings path="/options/" />
                <ManageBackups
                  path="/manage-backups"
                  showCreate={true}
                  />
              </Router>
            </div>
        );
    }
}
