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

import { Component, h, RenderableProps } from 'preact';
import { load } from '../../../decorators/load';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { Checkbox } from '../../forms';

interface ToggleProps {
    deviceID: string;
}

interface LoadedProps {
    enabled: boolean;
}

type Props = ToggleProps & LoadedProps & TranslateProps;

class Toggle extends Component<Props, {}> {
    private handleToggle = event => {
        apiPost(
            'devices/bitbox02-bootloader/' + this.props.deviceID + '/set-firmware-hash-enabled',
            event.target.checked,
        );
    }

    public render(
        { t,
          enabled,
        }: RenderableProps<Props>,
        {}: {},
    ) {
        return (
            <Checkbox
                checked={enabled}
                id="togggle-show-firmware-hash"
                onChange={this.handleToggle}
                label={t('bb02Bootloader.advanced.toggleShowFirmwareHash')}
                className="text-medium" />
        );
    }
}

const loadHOC = load<LoadedProps, ToggleProps & TranslateProps>(({ deviceID }) => ({ enabled: 'devices/bitbox02-bootloader/' + deviceID + '/show-firmware-hash-enabled' }))(Toggle);
const HOC = translate<ToggleProps>()(loadHOC);
export { HOC as ToggleShowFirmwareHash };
