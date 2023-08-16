/**
 * Copyright 2023 Shift Crypto AG
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

// TODO
export default function BitsuranceGuide() {
  const { t } = useTranslation();

  return (
    <Guide>
      <Entry key="guide.buy.security" entry={{
        link: {
          text: t('buy.info.disclaimer.security.link'),
          url: 'https://bitbox.swiss/bitbox02/threat-model/',
        },
        text: t('buy.info.disclaimer.security.descriptionGeneric'),
        title: t('buy.info.disclaimer.security.title'),
      }} shown={true} />
    </Guide>
  );
}
