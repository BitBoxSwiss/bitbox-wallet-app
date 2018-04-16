import { Component } from 'preact';
import style from './transaction.css';

import IN from './assets/icon-transfer-in.svg';
import OUT from './assets/icon-transfer-out.svg';
// TODO: import SELF from './assets/icon-transfer-self.svg';

const transferIconMap = {
    receive: IN,
    send_to_self: IN,
    send: OUT
};

export default class Transaction extends Component {
    constructor(props) {
        super(props);
        this.state = { collapsed: true };
    }

    onUncollapse = (e) => {
        this.setState(({ collapsed }) => ({ collapsed: !collapsed }));
    }

    render({ explorerURL, type, id, amount, fee, height }, { collapsed }) {
        return (
            <div class={style.transaction}
                onClick={this.onUncollapse}
                style={!collapsed && 'background: var(--background-active);'}
            >
                <div className={style.summary}>
                    <img src={transferIconMap[type]} />
                    <span className={style.address}>
                        {id}<br />
                        <time>Height:{' '}{height}</time>
                    </span>
                    <span className={style.amount}>{amount}</span>
                </div>
                <div hidden={collapsed ? 'hidden' : null} className={style.detail}>
                    <dl>
                        <dt>Transaction ID</dt>
                        <dd>
                            <a href={ explorerURL + id } target="_blank">{id}</a><br />
                            (Open in external block Explorer)
                        </dd>
                        <dt>Address</dt>
                        <dd>
                            <a href={ explorerURL + id } target="_blank">{id}</a><br />
                            (Open in external block Explorer)
                        </dd>
                        { fee &&
                          <div>
                              <dt>Fee</dt>
                              <dd>{fee}</dd>
                          </div>
                        }
                    </dl>
                    {/*
                    Type: {type}<br />
                    Height: {height}<br />
                    Amount: {amount}<br />
                      */}

                </div>
            </div>
        );
    }

}
