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

import React, { PropsWithChildren } from 'react';
import { Fiat } from '../../../../api/account';
import { Star, StarInactive } from '../../../../components/icon';
import {
  currencies,
  selectFiat,
  setActiveFiat,
  SharedProps,
  store,
  unselectFiat,
} from '../../../../components/rates/rates';
import { Toggle } from '../../../../components/toggle/toggle';
import { share } from '../../../../decorators/share';
import { translate, TranslateProps } from '../../../../decorators/translate';
import parentStyle from '../../settings.module.css';
import style from './fiat.module.css';

function changeSelected(event: React.SyntheticEvent): void {
  const target = event.target as HTMLInputElement;
  if (target.checked) {
    selectFiat(target.value as Fiat);
  } else {
    unselectFiat(target.value as Fiat);
  }
}

function setDefault(event: React.SyntheticEvent): void {
  const target = event.currentTarget as HTMLElement;
  setActiveFiat(target!.dataset.code as Fiat);
  event.preventDefault();
}

type Props = SharedProps & TranslateProps;

function Selection({
  t,
  active,
  selected,
}: PropsWithChildren<Props>): JSX.Element | null {
  return (
    <div>
      <h3 className="subTitle">{t('fiat.title')}</h3>
      <div className="box slim">
        {
          currencies.map((currency, index) => {
            const main = currency === active;
            const toggled = selected.includes(currency);
            return (
              <div key={currency} className={parentStyle.setting}>
                <p className="m-none">{currency}</p>
                {
                  toggled && (
                    <a
                      className={[style.star, main ? style.active : ''].join(' ')}
                      href="#"
                      title={t(main ? 'fiat.default' : 'fiat.setDefault', { code: currency })}
                      data-code={currency}
                      onClick={setDefault}>
                      { main ? <Star /> : <StarInactive /> }
                    </a>
                  )
                }
                <Toggle
                  key={currency}
                  name="fiat"
                  id={`fiat-${index}`}
                  // label={currency}
                  checked={toggled}
                  disabled={main}
                  onChange={changeSelected}
                  value={currency} />
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

export const FiatSelection = translate()(share<SharedProps, TranslateProps>(store)(Selection));
