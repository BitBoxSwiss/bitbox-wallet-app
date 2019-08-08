/**
 * Copyright 2018 Shift Devices AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { h, RenderableProps } from 'preact';
import { share } from '../../decorators/share';
import { translate, TranslateProps } from '../../decorators/translate';
import { Checkbox } from '../forms';
import { Fiat, selectFiat, setActiveFiat, SharedProps, store, unselectFiat } from '../rates/rates';
import * as style from './fiat.css';

function changeSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
        selectFiat(target.value as Fiat);
    } else {
        unselectFiat(target.value as Fiat);
    }
}

function setDefault(event: Event): void {
    const target = event.target as HTMLInputElement;
    setActiveFiat(target.dataset.code as Fiat);
    event.preventDefault();
}

type Props = SharedProps & TranslateProps;

function Selection({
    t,
    rates,
    active,
    selected,
}: RenderableProps<Props>): JSX.Element | null {
    if (!rates) {
        return null;
    }
    const currencies = Object.keys(rates.BTC) as Fiat[];
    return (
        <div>
            <div class="subHeaderContainer first">
                <div class="subHeader">
                    <h3>{t('fiat.title')}</h3>
                </div>
            </div>
            <div className={style.container}>
                <div className={style.left}>
                    <label className="labelLarge">Available Currencies</label>
                    <div className={[style.content, style.fiatList].join(' ')}>
                        {
                            currencies.map((currency, index) => {
                                const main = currency === active;
                                return !selected.includes(currency) ? (
                                    <Checkbox
                                        key={currency}
                                        name="fiat"
                                        id={`fiat-${index}`}
                                        label={currency}
                                        checked={selected.includes(currency)}
                                        disabled={main}
                                        onChange={changeSelected}
                                        value={currency}
                                        className="text-medium" />
                                ) : null;
                            })
                        }
                    </div>
                </div>
                <div className={style.right}>
                    <label className="labelLarge">Active Currencies</label>
                    <div className={[style.content, style.fiatList].join(' ')}>
                        {
                            currencies.map((currency, index) => {
                                const main = currency === active;
                                return selected.includes(currency) ? (
                                    <Checkbox
                                        key={currency}
                                        name="fiat"
                                        id={`fiat-${index}`}
                                        label={currency}
                                        checked={selected.includes(currency)}
                                        disabled={main}
                                        onChange={changeSelected}
                                        value={currency}
                                        className="text-medium">
                                        <span
                                            tabIndex={0}
                                            className={[style.button, main ? style.show : ''].join(' ')}
                                            onClick={setDefault}
                                            data-code={currency}>
                                            {t(main ? 'fiat.default' : 'fiat.setDefault', {
                                                code: currency,
                                            })}
                                        </span>
                                    </Checkbox>
                                ) : null;
                            })
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

export const FiatSelection = translate()(share<SharedProps, TranslateProps>(store)(Selection));
