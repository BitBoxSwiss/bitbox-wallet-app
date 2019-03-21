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
import { translate, TranslateProps } from '../../../decorators/translate';

interface RestoreBackupProps {
    deviceID: string;
}

type Props = RestoreBackupProps & TranslateProps;

class RestoreBackup extends Component<Props, {}> {
    public render(
        {
        }: RenderableProps<Props>,
        {
        }: {}) {
        return (
            <div>ok</div>
        );
    }
}

const HOC = translate<RestoreBackupProps>()(RestoreBackup);
export { HOC as RestoreBackup };
