// SPDX-License-Identifier: Apache-2.0

import { useMobileLayout } from '@/hooks/mobile-layout';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useOnlyVisitableOnMobile = (redirectUrl: string) => {
  const navigate = useNavigate();
  const isMobile = useMobileLayout();
  useEffect(() => {
    if (!isMobile) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isMobile, navigate, redirectUrl]);
};