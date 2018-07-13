import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet } from '../../utils/request';
import { Checkbox } from '../forms';
import style from './fiat.css';

@translate()
export default class Fiat extends Component {
    state = {
        currencies: []
    }

    componentDidMount() {
        apiGet('coins/rates').then(rates => this.setState({
            currencies: Object.keys(rates.BTC)
        }));
    }

    change = event => {
        if (event.target.checked) {
            this.props.fiat.add(event.target.value);
        } else {
            this.props.fiat.remove(event.target.value);
        }
    }

    setDefault = event => {
        const code = event.target.dataset.code;
        this.props.fiat.set(code);
        this.setState({ fiatCode: code });
        event.preventDefault();
    }

    render({
        t,
        fiat,
    }, {
        currencies,
    }) {
        if (!currencies || !currencies.length) {
            return null;
        }
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
                                    key={currency}
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
                                        className={[style.action, active ? style.show : ''].join(' ')}
                                        onClick={this.setDefault}
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
