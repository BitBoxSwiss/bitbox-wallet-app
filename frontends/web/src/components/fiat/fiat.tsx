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
import { translate, TranslateProp } from '../../decorators/translate';
import { Checkbox } from '../forms';
import { Fiat, selectFiat, setActiveFiat, SharedProps, store, unselectFiat } from '../rates/rates';
import * as style from './fiat.css';

function changeSelected(event): void {
    if (event.target.checked) {
        selectFiat(event.target.value);
    } else {
        unselectFiat(event.target.value);
    }
}

function setDefault(event): void {
    setActiveFiat(event.target.dataset.code);
    event.preventDefault();
}

type Props = SharedProps & TranslateProp;

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
            <div class="subHeaderContainer">
                <div class="subHeader">
                    <h3>{t('fiat.title')}</h3>
                </div>
            </div>
            <div class={style.fiatList}>
                {
                    currencies.map((currency, index) => {
                        const main = currency === active;
                        return (
                            // @ts-ignore
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
                        );
                    })
                }
            </div>
        </div>
    );
}

export const FiatSelection = translate()(share<SharedProps, TranslateProp>(store)(Selection));
