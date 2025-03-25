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

import { DependencyList, useEffect, useState } from 'react';
import { TDevices } from '@/api/devices';
import { checkSDCard } from '@/api/bitbox02';
import { getDeviceInfo as getBitBox01DeviceInfo } from '@/api/bitbox01';
import { useMountedRef } from './mount';

/**
 * useSDCard hook to check if one of the devices has a SDCard plugged in
 * @param devices which to check
 * @param dependencies optional array to re-run the check if any of the dependency change, devices is automatically added to the dependencies list
 */
export const useSDCard = (devices: TDevices, dependencies?: DependencyList) => {
  const [sdcard, setSDCard] = useState<boolean>(false);
  const mounted = useMountedRef();
  useEffect(() => {
    const deviceIDs = Object.keys(devices);
    Promise.all(
      deviceIDs.map((deviceID) => {
        switch (devices[deviceID]) {
          case 'bitbox':
            return getBitBox01DeviceInfo(deviceID).then((deviceInfo) =>
              deviceInfo
                ? deviceInfo.sdcard
                : Promise.reject(`Could get device info for ${deviceID}`),
            );
          case 'bitbox02':
            return checkSDCard(deviceID);
          default:
            return false;
        }
      }),
    )
      .then((sdcards) => sdcards.some((sdcard) => sdcard))
      .then((result) => {
        if (mounted.current) {
          setSDCard(result);
        }
      })
      .catch(console.error);
    // disable warning about mounted not in the dependency list
  }, [devices, ...(dependencies || [])]); // eslint-disable-line react-hooks/exhaustive-deps

  return sdcard;
};
