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
import i18n from '../../../i18n/i18n';
import { ButtonLink } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import Backups from '../../../components/backups/backups';
import Header from '../../../components/header/Header';
import * as styles from './manage-backups.css';

const ManageBackups = (props) => {
    return (
        <div class="contentWithGuide">
            <div class="container">
                <Header title={<h2>{i18n.t('backup.title')}</h2>} {...props} />
                <div className={styles.manageBackups}>
                    <Backups
                        deviceID={props.deviceID}
                        showCreate={true}
                        showRestore={false}>
                        <ButtonLink
                            secondary
                            href={`/device/${props.deviceID}`}>
                            {i18n.t('button.back')}
                        </ButtonLink>
                    </Backups>
                </div>
            </div>
            <Guide screen="backups" />
        </div>
    );
};

export default ManageBackups;
