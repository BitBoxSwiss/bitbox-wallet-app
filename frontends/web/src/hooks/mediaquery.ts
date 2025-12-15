// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string) => {
  const getMatches = (query: string) => window.matchMedia(query).matches;
  const [matches, setMatches] = useState(getMatches(query));

  useEffect(() => {
    const handleChange = () => {
      setMatches(getMatches(query));
    };
    const matchMedia = window.matchMedia(query);
    handleChange();

    matchMedia.addEventListener('change', handleChange);

    return () => {
      matchMedia.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};
