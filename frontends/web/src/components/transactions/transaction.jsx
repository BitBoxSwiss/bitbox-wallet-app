import { Component } from 'preact';
import style from './transaction.css';

import IN from './assets/icon-transfer-in.svg';
import OUT from './assets/icon-transfer-out.svg';

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
            <div class={style.transaction} onClick={this.onUncollapse}>
                <div className={style.summary}>
                    <img src={transferIconMap[type]} />
                    <span className={style.address}>
                        {id}<br />
                        <time>Height:{' '}{height}</time>
                    </span>
                    <span className={style.amount}>{amount}</span>
                </div>
                <div hidden={collapsed ? 'hidden' : null} className={style.detail}>
                    Type: {type}<br />
                    Height: {height}<br />
                    Amount: {amount}<br />
                    {fee && <div>Fee: {fee}</div>}
                    ID: <a href={ explorerURL + id } target="_blank">{id}</a>
                    <br />
                    (Open in external block Explorer)
                </div>
            </div>
        );
    }

}
