/**
 * Copyright 2025 Shift Crypto AG
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

import { Dialog } from '@/components/dialog/dialog';
import { useTranslation } from 'react-i18next';
import { A } from '@/components/anchor/anchor';
import styles from './connection-issues-dialog.module.css';

type Props = {
  dialogOpen: boolean;
  onClose: () => void;
};
export const ConnectionIssuesDialog = ({ dialogOpen, onClose }: Props) => {
  const { t } = useTranslation();
  return (
    <Dialog
      open={dialogOpen}
      title={t('novaConnectionIssues.connectionIssueTips')}
      onClose={onClose}
    >
      <div className={styles.content}>
        <div>
          <p className={styles.title}>{ t('novaConnectionIssues.title1') }</p>
          <p>{t('novaConnectionIssues.description1')}</p>
          <A href="https://shop.bitbox.swiss/">{t('novaConnectionIssues.link1')}</A>
        </div>

        <div>
          <p className={styles.title}>{ t('novaConnectionIssues.title2') }</p>
          <p>{ t('novaConnectionIssues.description2') }</p>
        </div>

        <div>
          <p className={styles.title}>{ t('novaConnectionIssues.title3') }</p>
          <p>{ t('novaConnectionIssues.description3') }</p>
        </div>

        <div>
          <p className={styles.title}>{ t('novaConnectionIssues.title4') }</p>
          <p>{ t('novaConnectionIssues.description4') }</p>
        </div>

        <div className={styles.appendix}>
          <p>{ t('novaConnectionIssues.stillHavingIssues') }</p>
          <A href="https://bitbox.swiss/support/">
            <p>{t('novaConnectionIssues.link2')}</p>
          </A>
        </div>
      </div>
    </Dialog>
  );
};