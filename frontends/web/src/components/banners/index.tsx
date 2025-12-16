// SPDX-License-Identifier: Apache-2.0

import type { AccountCode } from '@/api/account';
import type { TDevices } from '@/api/devices';
import { Testing } from './testing';
import { Update } from './update';
import { Banner } from './banner';
import { MobileDataWarning } from './mobiledatawarning';
import { Offline } from './offline';
import { SDCardWarning } from './sdcard';

type Props = {
  code?: AccountCode;
  devices: TDevices;
};

export const GlobalBanners = ({
  code,
  devices,
}: Props) => {
  return (
    <>
      <Testing />
      <Update />
      <Banner msgKey="bitbox01" />
      <Banner msgKey="bitbox02" />
      <Banner msgKey="bitbox02nova" />
      <MobileDataWarning />
      <Offline />
      <SDCardWarning code={code} devices={devices} />
    </>
  );
};
