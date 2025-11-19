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

import { spawn, ChildProcessByStdio } from 'child_process';
import path from 'path';
import type { Readable } from 'stream';

/**
 * Starts the AOPP server and waits until it prints its "ready" line.
 * Returns the spawned child process.
 */
export async function startAOPPServer(): Promise<
  ChildProcessByStdio<null, Readable, Readable>
> {
  const PROJECT_ROOT = process.env.GITHUB_WORKSPACE || path.resolve(__dirname, '../../../..');
  const scriptPath = path.join(PROJECT_ROOT, 'util', 'aoppserver');

  const child = spawn(scriptPath, [], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });


  const readyMsg =
    'Listening on localhost:8888. Demo website: http://localhost:8888';

  await new Promise<void>((resolve, reject) => {
    const onData = (data: Buffer) => {
      const text = data.toString();
      if (text.includes(readyMsg)) {
        child.stderr.off('data', onData);
        resolve();
      }
    };

    const onError = (err: Error) => {
      child.stderr.off('data', onData);
      reject(err);
    };

    child.stderr.on('data', onData);
    child.on('error', onError);
  });

  return child;
}

/**
 * Perform a POST request to the AOPP server and return the cleaned `uri` string.
 */
export async function generateAOPPRequest(
  asset: 'rbtc' | 'btc' | 'eth' | 'tbtc' = 'rbtc'
): Promise<string> {
  const allowed = ['rbtc', 'btc', 'eth', 'tbtc'] as const;
  if (!allowed.includes(asset)) {
    throw new Error(`Invalid asset: ${asset}. Allowed: ${allowed.join(', ')}`);
  }

  const url = `http://localhost:8888/generate?asset=${asset}`;

  const res = await fetch(url, { method: 'POST' });

  if (!res.ok) {
    throw new Error(`AOPP server responded with ${res.status}`);
  }

  const json = await res.json();

  if (!json.uri || typeof json.uri !== 'string') {
    throw new Error('AOPP server returned unexpected JSON');
  }

  // Clean: decode Unicode escapes and URL-encoded characters
  const unicodeDecoded = json.uri.replace(/\\u([\dA-Fa-f]{4})/g, (_: string, g: string) =>
    String.fromCharCode(parseInt(g, 16))
  );

  const urlDecoded = decodeURIComponent(unicodeDecoded);

  return urlDecoded;
}
