import { translate } from 'react-i18next';
import { Checkbox } from '../forms';
import UpdatingComponent from '../updating/updating';
import Dialog from '../dialog/dialog';
import style from './fiat.css';

@translate()
export default class FiatSwitcher extends UpdatingComponent {
    state = {
        activeDialog: false,
    }

    map = [ { url: 'coins/rates', key: 'rates' } ];
    
    change = event => {
        if (event.target.checked) {
            this.props.fiat.add(event.target.dataset.code);
        } else {
            this.props.fiat.remove(event.target.dataset.code);
        }
    }

    set = event => {
        this.props.fiat.set(event.target.dataset.code);
        this.setState({ activeDialog: false });
    }

    render({
        t,
        fiat,
    }, {
        activeDialog,
        rates,
    }) {
        if (!rates) {
            return null;
        }
        const currencies = Object.keys(rates.BTC);
        return (
            <span>
                <span className={style.button} onClick={() => this.setState({ activeDialog: true })}>
                    {t('fiat.action')}
                </span>
                {
                    activeDialog && (
                        <Dialog small title={t('fiat.title')}>
                            {
                                currencies.map((currency, index) => {
                                    return (
                                        <div className={style.entry}>
                                            <span className={style.box}>
                                                <Checkbox
                                                    id={index}
                                                    label={currency}
                                                    checked={fiat.list.includes(currency)}
                                                    onChange={this.change}
                                                    data-code={currency} />
                                            </span>

                                            <span className={style.action} onClick={this.set} data-code={currency}>
                                                {t('fiat.default')}
                                            </span>
                                        </div>
                                    );
                                })
                            }
                        </Dialog>
                    )
                }
            </span>
        );
    }
}
