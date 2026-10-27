// SPDX-License-Identifier: Apache-2.0

import { useLocation } from '@/utils/router-compatability';
import type { TDevices } from '@/api/devices';
import { Testing } from './testing';
import { Update } from './update';
import { FirmwareUpdateBanner } from './firmware-update';
import { Banner } from './banner';
import { MobileDataWarning } from './mobiledatawarning';
import { Offline } from './offline';
import { SDCardWarning } from './sdcard';
import { AttestationWarnings } from './attestation';

type Props = {
  devices: TDevices;
};

export const GlobalBanners = ({
  devices,
}: Props) => {
  const { pathname } = useLocation();
  const isManagingBackups = pathname.startsWith('/manage-backups/');

  return (
    <>
      <AttestationWarnings devices={devices} />
      <Testing />
      <Update />
      <FirmwareUpdateBanner devices={devices} />
      <Banner msgKey="bitbox01" />
      <Banner msgKey="bitbox02" />
      <Banner msgKey="bitbox02nova" />
      <MobileDataWarning />
      <Offline />
      {!isManagingBackups && <SDCardWarning devices={devices} />}
    </>
  );
};
