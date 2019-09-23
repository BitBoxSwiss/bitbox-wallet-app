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
import { Toggle } from '../../toggle/toggle';

interface ToggleProps {
    deviceID: string;
}

interface LoadedProps {
    enabled: boolean;
}

type Props = ToggleProps & LoadedProps & TranslateProps;

class ToggleFWHash extends Component<Props, {}> {
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
            <div className="box slim divide">
                <div class="flex flex-row flex-between flex-items-center">
                    <p className="m-none">{t('bb02Bootloader.advanced.toggleShowFirmwareHash')}</p>
                    <Toggle
                        checked={enabled}
                        id="togggle-show-firmware-hash"
                        onChange={this.handleToggle}
                        className="text-medium" />
                </div>
            </div>
        );
    }
}

const loadHOC = load<LoadedProps, ToggleProps & TranslateProps>(({ deviceID }) => ({ enabled: 'devices/bitbox02-bootloader/' + deviceID + '/show-firmware-hash-enabled' }))(ToggleFWHash);
const HOC = translate<ToggleProps>()(loadHOC);
export { HOC as ToggleShowFirmwareHash };
