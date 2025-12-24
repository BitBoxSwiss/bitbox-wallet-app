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
  coinName: string;
};

export const BitcoinBasedAccountInfoGuide = ({
  coinName,
}: Props) => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.accountInformation')}>
      <Entry key="guide.accountInfo.xpub" entry={{
        text: t('guide.accountInfo.xpub.text'),
        title: t('guide.accountInfo.xpub.title'),
      }} shown={true} />
      <Entry key="guide.accountInfo.multipleXPubs" entry={{
        text: t('guide.accountInfo.multipleXPubs.text', { coinName }),
        title: t('guide.accountInfo.multipleXPubs.title'),
      }} />
      <Entry key="guide.accountInfo.privacy" entry={{
        text: t('guide.accountInfo.privacy.text'),
        title: t('guide.accountInfo.privacy.title'),
      }} />
      <Entry key="guide.accountInfo.verify" entry={{
        text: t('guide.accountInfo.verify.text'),
        title: t('guide.accountInfo.verify.title'),
      }} />
    </Guide>
  );
};
