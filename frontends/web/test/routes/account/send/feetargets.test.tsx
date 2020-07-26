/**
 * Copyright 2020 Shift Crypto AG
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

import 'jest';
import '../../../matchmediastub';

import { h } from 'preact';
import { deep } from 'preact-render-spy';

jest.mock('../../../../src/utils/request');
import { apiGet } from '../../../../src/utils/request';

jest.mock('../../../../src/i18n/i18n');

jest.mock('../../../../src/decorators/translate', () => ({
    // this mock makes sure any components using the translate HoC receive the t function as a prop
    translate: () => Component => {
        Component.defaultProps = { ...Component.defaultProps, t: () => '' };
        return Component;
    },
}));

import { FeeTargets, Props } from '../../../../src/routes/account/send/feetargets';

describe('routes/account/send/feetargets', () => {
    it('should match the snapshot', () => {
        (apiGet as jest.Mock).mockResolvedValue({
            defaultFeeTarget: 'economy',
            feeTargets: [{ code: 'economy' }],
        });

        const fee = deep<Props, {}>(
            <FeeTargets
                accountCode="btc"
                disabled={false}
                fiatUnit="USD"
                onFeeTargetChange={jest.fn()} />,
        );
        expect(fee).toMatchSnapshot();
    });

    it('should call onFeeTargetChange', () => {
        const apiGetMock = (apiGet as jest.Mock).mockResolvedValue({
            defaultFeeTarget: 'normal',
            feeTargets: [
                { code: 'low' },
                { code: 'economy' },
                { code: 'normal' },
                { code: 'high' },
            ],
        });

        const onFeeTargetChangeCB = jest.fn();

        deep<Props, {}>(
            <FeeTargets
                accountCode="btc"
                disabled={false}
                fiatUnit="USD"
                onFeeTargetChange={onFeeTargetChangeCB} />,
        );
        expect(apiGetMock).toHaveBeenCalled();
        expect(onFeeTargetChangeCB).toHaveBeenCalledWith('normal');
    });
});
