import { translate } from 'react-i18next';
import { Checkbox } from '../forms';
import UpdatingComponent from '../updating/updating';
import style from './fiat.css';

@translate()
export default class FiatSwitcher extends UpdatingComponent {
    getStateMap() {
        return { rates: 'coins/rates' };
    }

    change = event => {
        if (event.target.checked) {
            this.props.fiat.add(event.target.value);
        } else {
            this.props.fiat.remove(event.target.value);
        }
    }

    set = event => {
        const code = event.target.dataset.code;
        this.props.fiat.set(code);
        if (!this.props.fiat.list.includes(code)) {
            this.props.fiat.add(code);
        }
        event.preventDefault();
    }

    render({
        t,
        fiat,
    }, {
        rates,
    }) {
        if (!rates) {
            return null;
        }
        const currencies = Object.keys(rates.BTC);
        return (
            <div>
                <div class="subHeaderContainer">
                    <div class="subHeader">
                        <h3>{t('fiat.title')}</h3>
                    </div>
                </div>
                <div class={style.fiatList}>
                    {
                        currencies.map((currency, index) => {
                            const active = currency === fiat.code;
                            return (
                                <Checkbox
                                    name="oldmoney"
                                    id={`fiat-${index}`}
                                    label={currency}
                                    checked={fiat.list.includes(currency)}
                                    disabled={active}
                                    onChange={this.change}
                                    value={currency}
                                    className="text-medium">
                                    <span
                                        tabIndex="0"
                                        className={[style.action, active && style.show].join(' ')}
                                        onClick={this.set}
                                        data-code={currency}>
                                        {t(active ? 'fiat.default' : 'fiat.setDefault', {
                                            code: currency
                                        })}
                                    </span>
                                </Checkbox>
                            );
                        })
                    }
                </div>
            </div>
        );
    }
}
