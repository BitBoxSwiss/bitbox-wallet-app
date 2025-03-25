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

import { useTranslation } from 'react-i18next';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';

type Props = {
  hasMultipleAddresses: boolean;
  hasDifferentFormats: boolean;
};

export const ReceiveGuide = ({
  hasMultipleAddresses,
  hasDifferentFormats,
}: Props) => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.receive')}>
      <Entry
        key="guide.receive.address"
        entry={t('guide.receive.address', { returnObjects: true })}
      />
      <Entry
        key="guide.receive.whyVerify"
        entry={t('guide.receive.whyVerify', { returnObjects: true })}
      />
      <Entry
        key="guide.receive.howVerify"
        entry={t('guide.receive.howVerify', { returnObjects: true })}
      />
      <Entry
        key="guide.receive.plugout"
        entry={t('guide.receive.plugout', { returnObjects: true })}
      />
      {hasMultipleAddresses && (
        <>
          <Entry
            key="guide.receive.whyMany"
            entry={t('guide.receive.whyMany', { returnObjects: true })}
          />
          <Entry
            key="guide.receive.why20"
            entry={t('guide.receive.why20', { returnObjects: true })}
          />
          <Entry
            key="guide.receive.addressChange"
            entry={t('guide.receive.addressChange', { returnObjects: true })}
          />
          {hasDifferentFormats && (
            <Entry
              key="guide.receive.addressFormats"
              entry={t('guide.receive.addressFormats', { returnObjects: true })}
            />
          )}
        </>
      )}
    </Guide>
  );
};
