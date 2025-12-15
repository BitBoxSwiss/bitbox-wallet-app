// SPDX-License-Identifier: Apache-2.0

import { useMediaQuery } from '@/hooks/mediaquery';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useOnlyVisitableOnMobile = (redirectUrl: string) => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  useEffect(() => {
    if (!isMobile) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isMobile, navigate, redirectUrl]);
};