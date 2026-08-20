// SPDX-License-Identifier: Apache-2.0

import type { TDevices } from '@/api/devices';
import { Testing } from './testing';
import { Update } from './update';
import { FirmwareUpdateBanner } from './firmware-update';
import { Banner } from './banner';
import { MobileDataWarning } from './mobiledatawarning';
import { Offline } from './offline';
import { SDCardWarning } from './sdcard';

type Props = {
  devices: TDevices;
};

export const GlobalBanners = ({
  devices,
}: Props) => {
  return (
    <>
      <Testing />
      <Update />
      <FirmwareUpdateBanner devices={devices} />
      <Banner msgKey="bitbox01" />
      <Banner msgKey="bitbox02" />
      <Banner msgKey="bitbox02nova" />
      <MobileDataWarning />
      <Offline />
      <SDCardWarning devices={devices} />
    </>
  );
};
