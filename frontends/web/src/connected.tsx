// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useEffect, useState } from 'react';
import { backendConnected } from './api/subscribe';

type TProps = {
  children: ReactNode;
};

export const ConnectedApp = ({ children }: TProps) => {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    return backendConnected(connected => {
      setConnected(connected);
    });
  }, []);

  if (!connected) {
    return (
      <div className="app" style={{ padding: 40 }}>
        The WebSocket closed. Please restart the backend and reload this page.
      </div>
    );
  }
  return <div>{children}</div>;
};
