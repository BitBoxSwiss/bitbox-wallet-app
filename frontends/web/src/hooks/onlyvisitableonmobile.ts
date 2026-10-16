// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMediaQuery } from '@/hooks/mediaquery';

export const useOnlyVisitableOnMobile = (redirectUrl: string) => {
  const [, navigate] = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  useEffect(() => {
    if (!isMobile) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isMobile, navigate, redirectUrl]);
};
