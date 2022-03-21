/**
 * Copyright 2022 Shift Crypto AG
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

import { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad } from '../../../../hooks/api';
import { hasMobileChannel } from '../../../../api/devices';
import Status from '../../../../components/status/status';

type Props = {
    deviceID: string;
}

export const PairedWarning: FunctionComponent<Props> = ({
    deviceID,
}) => {
    const { t } = useTranslation();
    const paired = useLoad(hasMobileChannel(deviceID));
    if (paired) {
        return null;
    }
    return (
        <Status type="warning" hidden={paired !== false}>
            {t('warning.receivePairing')}
        </Status>
    );
};
