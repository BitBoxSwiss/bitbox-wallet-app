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

import { Component, h, RenderableProps } from 'preact';
import { translate, TranslateProps } from '../../../decorators/translate';
import * as dialogStyle from '../../dialog/dialog.css';
import { Dialog } from '../../dialog/dialog';
import { apiGet } from '../../../utils/request';
import { Button, ButtonLink } from '../../forms';

interface SDCardCheckProps {
    deviceID: string;
}

interface State {
    sdCardInserted?: boolean;
}


type Props = SDCardCheckProps & TranslateProps;

class SDCardCheck extends Component<Props, State> {
    public componentDidMount() {
        this.check();
    }

    private check = () => {
        apiGet('devices/bitbox02/' + this.props.deviceID + '/check-sdcard')
            .then(inserted => this.setState({ sdCardInserted: inserted }));
    }

    public render(
        { t,
          children,
          deviceID,
        }: RenderableProps<Props>,
        { sdCardInserted }: State) {
        if (sdCardInserted === undefined) {
            return null;
        }
        if (!sdCardInserted) {
            return (
                <Dialog title="Check your device" small>
                    <div className="columnsContainer half">
                        <div className="columns">
                            <div className="column">
                                <p>{this.props.t('backup.insert')}</p>
                            </div>
                        </div>
                    </div>
                    <div className={dialogStyle.actions}>
                        <Button
                            primary
                            onClick={this.check}>
                            {t('button.ok')}
                        </Button>
                        <ButtonLink
                            transparent
                            href={`/device/${deviceID}`}>
                            {t('button.back')}
                        </ButtonLink>
                    </div>
                </Dialog>
            );
        }
        return (
            <div>
                {children}
            </div>
        );
    }

}

const HOC = translate<SDCardCheckProps>()(SDCardCheck);
export { HOC as SDCardCheck };
