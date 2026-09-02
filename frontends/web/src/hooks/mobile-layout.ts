// SPDX-License-Identifier: Apache-2.0

import { useMediaQuery } from './mediaquery';

export const MOBILE_LAYOUT_QUERY = [
  '(max-width: 768px)',
  '(orientation: landscape) and (max-height: 600px) and (hover: none) and (pointer: coarse)',
].join(', ');

export const useMobileLayout = () => useMediaQuery(MOBILE_LAYOUT_QUERY);
