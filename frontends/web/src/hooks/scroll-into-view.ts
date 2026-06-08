// SPDX-License-Identifier: Apache-2.0

import { RefObject, useCallback } from 'react';

const findScrollableAncestor = (el: HTMLElement): HTMLElement | null => {
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
};

/**
 * Smooth-scrolls the referenced element into view within its nearest
 * scrollable ancestor. `offset` adds top margin.
 */
export const useScrollIntoView = (
  ref: RefObject<HTMLElement | null>,
  offset = 0,
) => {
  return useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const scrollable = findScrollableAncestor(el);
    if (!scrollable) {
      return;
    }
    const elRect = el.getBoundingClientRect();
    const scrollableRect = scrollable.getBoundingClientRect();
    const top = elRect.top - scrollableRect.top + scrollable.scrollTop - offset;
    scrollable.scrollTo({ top, behavior: 'smooth' });
  }, [ref, offset]);
};
