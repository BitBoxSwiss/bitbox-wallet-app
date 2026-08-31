// SPDX-License-Identifier: Apache-2.0

import { spawn, ChildProcessByStdio } from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import path from 'path';
import type { Readable } from 'stream';

export interface AOPPServer {
  process: ChildProcessByStdio<null, Readable, Readable>;
  caCertPath: string;
}

/**
 * Starts the AOPP server and waits until it prints its "ready" line.
 * Returns the spawned child process and its temporary CA certificate.
 */
export async function startAOPPServer(): Promise<AOPPServer> {
  const PROJECT_ROOT = (
    process.env.GITHUB_WORKSPACE ||
    path.resolve(__dirname, '../../../..')
  );

  const scriptPath = path.resolve(PROJECT_ROOT, 'frontends/web/tests/util/aopp/server.py');

  const child = spawn('python3', ['-u', scriptPath], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  const caCertPath = await new Promise<string>((resolve, reject) => {
    let output = '';
    const onData = (data: Buffer) => {
      output += data.toString();
      const match = output.match(/Listening on https:\/\/localhost:8888 with CA certificate (.+)/);
      if (match?.[1]) {
        child.stdout.off('data', onData);
        resolve(match[1].trim());
      }
    };

    const onError = (err: Error) => {
      child.stdout.off('data', onData);
      reject(err);
    };

    child.stdout.on('data', onData);
    child.on('error', onError);
  });

  return { process: child, caCertPath };
}

/**
 * Perform a POST request to the AOPP server and return the cleaned `uri` string.
 */
export async function generateAOPPRequest(
  caCertPath: string,
  asset: 'rbtc' | 'btc' | 'eth' | 'tbtc' = 'rbtc'
): Promise<string> {
  const allowed = ['rbtc', 'btc', 'eth', 'tbtc'] as const;
  if (!allowed.includes(asset)) {
    throw new Error(`Invalid asset: ${asset}. Allowed: ${allowed.join(', ')}`);
  }

  const url = `https://localhost:8888/generate?asset=${asset}`;
  const { statusCode, body } = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const request = https.request(url, {
      method: 'POST',
      ca: fs.readFileSync(caCertPath),
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
      });
      response.on('end', () => resolve({ statusCode: response.statusCode ?? 0, body }));
    });
    request.on('error', reject);
    request.end();
  });

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`AOPP server responded with ${statusCode}`);
  }

  const json = JSON.parse(body) as { uri?: unknown };

  if (!json.uri || typeof json.uri !== 'string') {
    throw new Error('AOPP server returned unexpected JSON');
  }

  return json.uri;
}
