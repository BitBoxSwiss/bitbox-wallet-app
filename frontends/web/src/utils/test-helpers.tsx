// SPDX-License-Identifier: Apache-2.0

import { type ReactNode, useEffect, useState } from 'react';
import { Router } from 'wouter';

type TProps = {
  children?: ReactNode;
  initialEntries?: string[];
  initialIndex?: number;
};

export const MemoryRouter = ({
  children,
  initialEntries = ['/'],
  initialIndex = initialEntries.length - 1,
}: TProps) => {
  useEffect(() => {
    const entries = initialEntries.slice(0, initialIndex + 1);

    entries.forEach((entry, index) => {
      if (index === 0) {
        window.history.replaceState({}, '', entry);
      } else {
        window.history.pushState({}, '', entry);
      }
    });

    // pushState doesn't dispatch popstate.
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [initialEntries, initialIndex]);

  return (
    <Router>
      {children}
    </Router>
  );
};

export const HistoryRouter = ({
  children,
  initialEntries = ['/'],
  initialIndex = initialEntries.length - 1,
}: TProps) => {
  const [initialized] = useState(() => {
    const entries = initialEntries.slice(0, initialIndex + 1);

    entries.forEach((entry, index) => {
      if (index === 0) {
        window.history.replaceState({}, '', entry);
      } else {
        window.history.pushState({}, '', entry);
      }
    });

    return true;
  });

  return initialized ? <Router>{children}</Router> : null;
};
