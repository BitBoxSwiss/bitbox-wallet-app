/**
 * Copyright 2018 Shift Devices AG
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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBanner, syncBanner, TBannerInfo } from '@/api/banners';
import { Status } from '@/components/status/status';
import { A } from '@/components/anchor/anchor';
import style from './banner.module.css';

type TBannerProps = {
  msgKey: 'bitbox01' | 'bitbox02' | 'bitbox02nova';
}

export const Banner = ({ msgKey }: TBannerProps) => {
  const { i18n, t } = useTranslation();
  const { fallbackLng } = i18n.options;
  const [banner, setBanner] = useState<TBannerInfo>();

  useEffect(() => {
    getBanner(msgKey).then(setBanner);
    syncBanner(msgKey, setBanner);
  }, [msgKey]);

  if (
    !banner
    || !fallbackLng
    || !i18n.resolvedLanguage
  ) {
    return null;
  }
  const { message, link } = banner;

  const maybeFallbackLng: string = (
    Array.isArray(fallbackLng) && fallbackLng.length > 0
      ? fallbackLng[0]
      : fallbackLng
  );

  return (
    <Status
      dismissible={banner.dismissible ? `banner-${msgKey}-${banner.id}` : ''}
      type={banner.type ? banner.type : 'warning'}>
      {message[i18n.resolvedLanguage] || message[maybeFallbackLng || 'en']}
      &nbsp;
      {link && (
        <A href={link.href} className={style.link}>
          {link.text || t('clickHere')}
        </A>
      )}
    </Status>
  );
};
