// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLightningURI, subscribeLightningURI } from '@/api/lightning';
import { isLightningFeatureAvailable } from '@/utils/env';
import { useSync } from './api';

export const useLightningURI = () => {
  const available = isLightningFeatureAvailable();
  const request = useSync(
    available ? getLightningURI : null,
    available ? subscribeLightningURI : null,
    value => value.revision,
  );
  const handledRevision = useRef(0);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!request || request.input === null || request.revision <= handledRevision.current) {
      return;
    }
    // Keep setup mounted; activation opens the pending payment once it succeeds.
    if (pathname === '/lightning/activate') {
      return;
    }
    handledRevision.current = request.revision;
    // The send screen handles new links itself, deferring them while a payment is sending.
    if (pathname !== '/lightning/send') {
      navigate('/lightning/send');
    }
  }, [navigate, pathname, request]);

  return request;
};
