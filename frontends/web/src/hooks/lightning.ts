// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { LightningContext } from '../contexts/LightningContext';

export const useLightning = () => {
  const { lightningConfig } = useContext(LightningContext);
  return { lightningConfig };
};
