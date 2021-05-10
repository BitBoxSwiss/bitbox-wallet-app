/**
 * Copyright 2021 Shift Crypto AG
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
import * as accountApi from '../../../../api/account';
import * as backendAPI from '../../../../api/backend';
import { Select } from '../../../../components/forms';
import { translate, TranslateProps } from '../../../../decorators/translate';

interface CoinDropDownProps {
    onChange: (coin: accountApi.CoinCode) => void;
    supportedCoins: backendAPI.ICoin[];
    value: string;
}

type Props = CoinDropDownProps & TranslateProps;

function CoinDropDown({
    onChange,
    supportedCoins,
    t,
    value,
}: RenderableProps<Props>) {
    return (
        <Select
            options={[
                {
                    text: t('buy.info.selectPlaceholder'),
                    disabled: true,
                    value: 'choose',
                },
                ...(supportedCoins).map(({ coinCode, name, canAddAccount}) => ({
                    value: coinCode,
                    text: name,
                    disabled: !canAddAccount,
                }))
            ]}
            onInput={e => onChange(e.target.value)}
            defaultValue={'choose'}
            placeholder={t('buy.info.selectPlaceholder')}
            value={value}
            id="coinCodeDropDown" />
    );
}

const HOC = translate<CoinDropDownProps>()(CoinDropDown);

export { HOC as CoinDropDown };
