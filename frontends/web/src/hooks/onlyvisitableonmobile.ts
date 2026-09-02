// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMobileLayout } from '@/hooks/mobile-layout';

export const useOnlyVisitableOnMobile = (redirectUrl: string) => {
  const [, navigate] = useLocation();
  const isMobile = useMobileLayout();
  useEffect(() => {
    if (!isMobile) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isMobile, navigate, redirectUrl]);
};
