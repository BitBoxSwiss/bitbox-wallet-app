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

import { PropsWithChildren } from 'react';
import { subscribe } from '../../decorators/subscribe';
import { translate, TranslateProps } from '../../decorators/translate';
import A from '../anchor/anchor';
import Status from '../status/status';

interface BannerInfo {
    id: string;
    message: { [key: string]: string; };
    link?: {
        href: string;
        text: string;
    };
}

interface LoadedProps {
    banner: BannerInfo | null;
}

interface BannerProps {
    msgKey: 'bitbox01';
}

type Props = LoadedProps & BannerProps & TranslateProps;

function Banner({ banner, i18n, t }: PropsWithChildren<Props>): JSX.Element | null {
  if (!i18n.options.fallbackLng) {
    return null;
  }
  return banner && (
    <Status dismissable="" type="info">
      { banner.message[i18n.language] || banner.message[i18n.options.fallbackLng[0]] }&nbsp;
      { banner.link && (
        <A href={banner.link.href}>
          {t('clickHere')}
        </A>
      )}
    </Status>
  );
}

const HOC = translate()(
  subscribe<LoadedProps, BannerProps & TranslateProps>(
    ({ msgKey }) => ({ banner: 'banners/' + msgKey }),
    true,
    false,
  )(Banner),
);

export { HOC as Banner };
