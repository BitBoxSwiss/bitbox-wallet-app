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
    state = {
        collapsed: true,
    }

    onUncollapse = e => {
        this.setState(({ collapsed }) => ({ collapsed: !collapsed }));
    }

    parseTime = (time) => {
        let arr;
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        arr = time.split(' ');
        arr.pop();
        const dt = new Date(Date.parse(arr.join(' ')));
        return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()} - ${dt.getHours()}:${dt.getMinutes()}`;
    }

    render({
        explorerURL,
        type,
        id,
        amount,
        fee,
        height,
        time,
        addresses,
    }, {
        collapsed,
    }) {
        return (
            <div class={[style.transactionContainer, collapsed ? style.collapsed : style.expanded].join(' ')} onClick={this.onUncollapse}>
                <div class={['flex', 'flex-row', 'flex-start', 'flex-items-start', style.transaction].join(' ')}>
                    <div>
                        <img src={transferIconMap[type]} height="22" style="margin-right: var(--spacing-default)" />
                    </div>
                    <div class="flex-1" style="overflow: hidden;">
                        <div class={['flex', 'flex-row', 'flex-between', 'flex-items-start', style.row].join(' ')}>
                            <div class={style.date}>{time ? this.parseTime(time) : (height <= 0 ? 'Pending Transaction' : 'Time not yet available')}</div>
                            <div class={[style.amount, style[type]].join(' ')}>{amount}</div>
                        </div>
                        <div class={['flex', 'flex-row', 'flex-between', 'flex-items-start', style.row].join(' ')}>
                            <div class="flex flex-row flex-start flex-items-center">
                                <div class={[style.transactionLabel, style[type]].join(' ')}>
                                    {
                                        ['send', 'send_to_self'].includes(type.toString()) ? 'To' : 'From'
                                    }
                                </div>
                                <div class={[style.address].join(' ')}>{addresses}</div>
                            </div>
                            <div class={[style.amount, style.converted].join(' ')}>2.154 EUR</div>
                        </div>

                        <div hidden={collapsed ? 'hidden' : null} className={style.collapedContent}>
                            <div class={['flex', 'flex-row', 'flex-between', 'flex-items-start', style.row].join(' ')}>
                                <div>
                                    <div class={[style.transactionLabel].join(' ')}>Transaction ID (Open in external block Explorer)</div>
                                    <div class={[style.address].join(' ')}>
                                        <a href={ explorerURL + id } target="_blank">{id}</a>
                                    </div>
                                </div>
                            </div>
                            <div class={['flex', 'flex-row', 'flex-start', 'flex-items-start', style.row].join(' ')}>
                                <div>
                                    <div class={[style.transactionLabel].join(' ')}>Height</div>
                                    <div class={[style.address].join(' ')}>{height}</div>
                                </div>
                                {
                                    fee && (
                                        <div>
                                            <div class={[style.transactionLabel].join(' ')}>Fee</div>
                                            <div class={[style.address].join(' ')}>{fee}</div>
                                        </div>
                                    )
                                }
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        );
    }
}
