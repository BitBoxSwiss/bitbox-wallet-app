/**
 * Copyright 2018 Shift Devices AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, ReactNode } from 'react';
import { backendConnected } from './api/subscribe';

interface State {
  connected: boolean;
}

interface Props {
  children: ReactNode;
}

class ConnectedApp extends Component<Props, State> {
  public readonly state: State = {
    connected: true,
  };

  private unsubscribe!: () => void;

  public componentDidMount() {
    this.unsubscribe = backendConnected(connected => this.setState({ connected }));
  }

  public componentWillUnmount() {
    this.unsubscribe();
  }

  public render() {
    const { children } = this.props;
    const { connected } = this.state;
    if (!connected) {
      return (
        <div className="app" style={{ padding: 40 }}>
                    The WebSocket closed. Please restart the backend and reload this page.
        </div>
      );
    }
    return (
      <div>{children}</div>
    );
  }
}

export { ConnectedApp };
