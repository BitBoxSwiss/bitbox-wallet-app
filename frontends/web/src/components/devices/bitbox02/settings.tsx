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
import * as style from '../../../components/steps/steps.css';
import { translate, TranslateProps } from '../../../decorators/translate';
import RandomNumber from '../../../routes/device/settings/components/randomnumber';
import { Header } from '../../layout/header';
import DeviceInfo from './deviceinfo';
import SetDeviceName from './setdevicename';

interface SettingsProps {
    deviceID: string;
}

type Props = SettingsProps & TranslateProps;

class Settings extends Component<Props, {}> {
    public render(
        { deviceID,
        }: RenderableProps<Props>,
        {
        }: {}) {
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>Welcome</h2>} />
                    <div className={style.buttons}>
                        <RandomNumber apiPrefix={'devices/bitbox02/' + deviceID} />
                        <DeviceInfo apiPrefix={'devices/bitbox02/' + deviceID} />
                        <SetDeviceName apiPrefix={'devices/bitbox02/' + deviceID} />
                    </div>
                </div>
            </div>
        );
    }
}

const HOC = translate<SettingsProps>()(Settings);
export { HOC as Settings };
