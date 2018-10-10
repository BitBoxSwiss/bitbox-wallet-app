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

import { h } from 'preact';
import i18n from '../../../../i18n/i18n';
import { Message } from '../../../../components/message/message';
import { Alert } from '../../../../components/icon';

export function Tampered({
    style = null
}) {
    return (
        <Message type="warning" style={style}>
            <Alert />
            {i18n.t('deviceTampered')}
        </Message>
    );
}
