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

import { apiGet } from '@/utils/request';
import { subscribeEndpoint, TUnsubscribe } from './subscribe';
import type { TMessageTypes } from '@/utils/types';

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
