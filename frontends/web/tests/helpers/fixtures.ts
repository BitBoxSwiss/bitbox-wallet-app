/**
*  Copyright 2025 Shift Crypto AG
*
*  Licensed under the Apache License, Version 2.0 (the "License");
*  you may not use this file except in compliance with the License.
*  You may obtain a copy of the License at
*
*       http://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing, software
*  distributed under the License is distributed on an "AS IS" BASIS,
*  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*  See the License for the specific language governing permissions and
*  limitations under the License.
*/

import { test as baseTest } from '@playwright/test';

// Custom fixtures for host/ports
export const test = baseTest.extend<{
  host: string;
  frontendPort: number;
  servewalletPort: number;
}>({
  host: [process.env.HOST || 'localhost', { scope: 'worker' }],
  frontendPort: [parseInt(process.env.FRONTEND_PORT || '8080', 10), { scope: 'worker' }],
  servewalletPort: [parseInt(process.env.SERVE_WALLET_PORT || '8082', 10), { scope: 'worker' }],
});

