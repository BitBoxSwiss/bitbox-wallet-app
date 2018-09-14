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

import { h, RenderableProps } from 'preact';
import { App } from './app';
import { subscribe } from './decorators/subscribe';

interface Props {
    connected?: boolean;
}

function ConnectedApp({ connected = true }: RenderableProps<Props>): JSX.Element {
    return connected ? <App /> : (
        <div className="app" style="padding: 40px">
            The WebSocket closed. Please restart the backend and reload this page.
        </div>
    );
}

const HOC = subscribe<Props>({ connected: 'backend/connected' }, false, true)(ConnectedApp);

export { HOC as ConnectedApp };
