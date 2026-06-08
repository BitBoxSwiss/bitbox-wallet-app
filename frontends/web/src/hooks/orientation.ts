// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react';

type TOrientation = 'landscape' | 'portrait';

const getLegacyOrientation = (): TOrientation => {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
};

export const useOrientation = (): TOrientation => {
  const [orientation, setOrientation] = useState(getLegacyOrientation());

  useEffect(() => {
    const handleOrientation = () => setOrientation(getLegacyOrientation());
    window.addEventListener('resize', handleOrientation);
    return () => window.removeEventListener('resize', handleOrientation);
  }, []);

  return orientation;
};
