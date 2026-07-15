// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { syncBanner, TBannerInfo } from '@/api/banners';
import { useSubscribe } from '@/hooks/api';
import { Status } from '@/components/status/status';
import { A } from '@/components/anchor/anchor';
import style from './banner.module.css';

type TBannerProps = {
  msgKey: 'bitbox01' | 'bitbox02' | 'bitbox02nova';
};

export const Banner = ({ msgKey }: TBannerProps) => {
  const { i18n, t } = useTranslation();
  const { fallbackLng } = i18n.options;
  const banner = useSubscribe<TBannerInfo>(cb => syncBanner(msgKey, cb));

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
      dismissibleKey={banner.dismissible ? `banner-${msgKey}-${banner.id}` : ''}
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
