// SPDX-License-Identifier: Apache-2.0

import { type ReactNode, useState } from 'react';
import { Router } from 'wouter';
import { useHashLocation } from './router-compatability';

type TProps = {
  children?: ReactNode;
  initialEntries?: string[];
  initialIndex?: number;
};

const toHashUrl = (entry: string) => {
  const route = (
    entry.startsWith('#')
      ? entry.slice(1)
      : entry
  );

  return `/#${route.startsWith('/') ? route : `/${route}`}`;
};

export const MemoryRouter = ({
  children,
  initialEntries = ['/'],
  initialIndex = initialEntries.length - 1,
}: TProps) => {
  const [initialized] = useState(() => {
    const entries = initialEntries.slice(0, initialIndex + 1);

    entries.forEach((entry, index) => {
      const url = toHashUrl(entry);

      if (index === 0) {
        window.history.replaceState({}, '', url);
      } else {
        window.history.pushState({}, '', url);
      }
    });

    return true;
  });

  return initialized ? (
    <Router hook={useHashLocation}>
      {children}
    </Router>
  ) : null;
};

export const HistoryRouter = MemoryRouter;
