// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBanner, syncBanner, TBannerInfo } from '@/api/banners';
import { Status } from '@/components/status/status';
import { A } from '@/components/anchor/anchor';
import style from './banner.module.css';

type TBannerProps = {
  msgKey: 'bitbox01' | 'bitbox02' | 'bitbox02nova';
};

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
