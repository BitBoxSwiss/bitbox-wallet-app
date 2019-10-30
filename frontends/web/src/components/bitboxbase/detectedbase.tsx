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

import { Component, h, RenderableProps} from 'preact';
// import BaseLogo from '../../assets/icons/bbbase64.png';
import { translate, TranslateProps } from '../../decorators/translate';
import { SettingsButton } from '../settingsButton/settingsButton';
// import * as style from './bitboxbase.css';

interface DetectedBaseProps {
    ip: string;
    hostname: string;
    connect: (ip: string) => void;
}

type Props = DetectedBaseProps & TranslateProps;

class DetectedBase extends Component<Props> {
    constructor(props) {
        super(props);
    }

    private handleConnect = () => {
        const { connect, ip } = this.props;
        connect(ip);
    }

    public render(
        {
            // t,
            hostname,
            ip,
        }: RenderableProps<Props>,
    ) {
        // const logo = BaseLogo;
        return (
            <SettingsButton
                onClick={this.handleConnect}
                secondaryText={ip}
                optionalText="Uninitialized">
                {hostname}
            </SettingsButton>
        );
    }
}

const HOC = translate<DetectedBaseProps>()(DetectedBase);
export { HOC as DetectedBase};
