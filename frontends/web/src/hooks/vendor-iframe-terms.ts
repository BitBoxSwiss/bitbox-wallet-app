// SPDX-License-Identifier: Apache-2.0

import { Dispatch, SetStateAction, useEffect, useState } from 'react';

type TVendorIframeTerms = {
  agreedTerms: boolean;
  setAgreedTerms: Dispatch<SetStateAction<boolean>>;
};

export const useVendorIframeTerms = (agreedByConfig = false): TVendorIframeTerms => {
  const [agreedTerms, setAgreedTerms] = useState(agreedByConfig);

  useEffect(() => {
    setAgreedTerms(agreedByConfig);
  }, [agreedByConfig]);

  return { agreedTerms, setAgreedTerms };
};
