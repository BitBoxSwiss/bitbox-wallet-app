// SPDX-License-Identifier: Apache-2.0

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
  const PROJECT_ROOT = process.env.GITHUB_WORKSPACE ||
    path.resolve(__dirname, '../../../..');

  const scriptPath = path.resolve(PROJECT_ROOT, 'frontends/web/tests/util/aopp/server.py');

  const child = spawn('python3', ['-u', scriptPath], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  const readyMsg = 'Listening on localhost:8888';

  await new Promise<void>((resolve, reject) => {
    const onData = (data: Buffer) => {
      const text = data.toString();
      if (text.includes(readyMsg)) {
        child.stdout.off('data', onData);
        resolve();
      }
    };

    const onError = (err: Error) => {
      child.stdout.off('data', onData);
      reject(err);
    };

    child.stdout.on('data', onData);
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

  return json.uri;
}
