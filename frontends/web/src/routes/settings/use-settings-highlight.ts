// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SETTINGS_HIGHLIGHT_QUERY_PARAM } from './settings-search';

const HIGHLIGHT_DURATION_MS = 2700;

export const useSettingsHighlight = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedItemIDFromParams = searchParams.get(SETTINGS_HIGHLIGHT_QUERY_PARAM) || '';
  const [highlightedItemID, setHighlightedItemID] = useState(highlightedItemIDFromParams);

  useEffect(() => {
    if (!highlightedItemIDFromParams) {
      return;
    }

    setHighlightedItemID(highlightedItemIDFromParams);

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete(SETTINGS_HIGHLIGHT_QUERY_PARAM);
    setSearchParams(nextSearchParams, { replace: true });
  }, [highlightedItemIDFromParams, searchParams, setSearchParams]);

  useEffect(() => {
    if (!highlightedItemID) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setHighlightedItemID('');
    }, HIGHLIGHT_DURATION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [highlightedItemID]);

  return highlightedItemID;
};
