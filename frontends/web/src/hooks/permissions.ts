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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMountedRef } from './mount';

type TExperimentalDeviceName = 'camera' | 'microphone' | 'speaker';

export const useDevicePermission = (deviceName: TExperimentalDeviceName) => {
  const mounted = useMountedRef();
  const permissionObject = useRef<PermissionStatus>();
  const [permissionState, setPermissionState] = useState<PermissionState>();

  const handlePermissionChange = useCallback(() => {
    if (mounted.current && permissionObject.current) {
      setPermissionState(permissionObject.current.state);
    }
  }, [mounted]);

  useEffect(() => {
    navigator.permissions
      // TypeScript broke this somehow in 4.4.2
      // https://github.com/microsoft/TypeScript/issues/33923
      // Type '"camera"' is not assignable to type 'PermissionName'.ts(2322)
      .query({ name: deviceName } as unknown as PermissionDescriptor)
      .then((permissionStatus) => {
        permissionObject.current = permissionStatus;
        handlePermissionChange();
      });
  });

  useEffect(() => {
    if (permissionObject.current) {
      permissionObject.current.addEventListener('change', handlePermissionChange);
      return () => {
        permissionObject.current?.removeEventListener('change', handlePermissionChange);
      };
    }
  }, [handlePermissionChange, permissionObject]);

  return permissionState; // 'granted', 'denied' or 'prompt'
};
