/**
 * Copyright 2024 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';

export const LightningGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide>
      <Entry key="privateKey" entry={t('guide.lightning.privateKey')} />
      <Entry key="securedByBitBox" entry={t('guide.lightning.securedByBitBox')} />
      <Entry key="multipleDevices" entry={t('guide.lightning.multipleDevices')} />
      <Entry key="multipleWallets" entry={t('guide.lightning.multipleWallets')} />
      <Entry key="providers" entry={t('guide.lightning.providers')} />
    </Guide>
  );
};
