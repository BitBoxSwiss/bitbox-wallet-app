// SPDX-License-Identifier: Apache-2.0

import type { TMessageTypes } from '@/utils/types';
import { apiGet } from '@/utils/request';
import { subscribeEndpoint, TUnsubscribe } from './subscribe';

export type TBannerInfo = {
  id: string;
  message: { [key: string]: string };
  link?: {
    href: string;
    text?: string;
  };
  dismissible?: boolean;
  type?: TMessageTypes;
};

export const getBanner = (msgKey: string): Promise<TBannerInfo> => {
  return apiGet(`banners/${msgKey}`);
};

export const syncBanner = (
  msgKey: string,
  cb: (banner: TBannerInfo) => void,
): TUnsubscribe => {
  return subscribeEndpoint(`banners/${msgKey}`, cb);
};
