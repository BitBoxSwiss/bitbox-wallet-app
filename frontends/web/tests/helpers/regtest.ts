// SPDX-License-Identifier: Apache-2.0

import { exec, spawn, ChildProcess } from 'child_process';
import path from 'path';
import util from 'util';
import fs from 'fs';


const execAsync = util.promisify(exec);

const RPC_USER = 'dbb';
const RPC_PASSWORD = 'dbb';
const RPC_PORT = 10332;
const DATADIR = '/bitcoin';

let addr: string;

// run bitcoin-cli command inside the bitcoind-regtest docker container.
async function runBitcoinCli(args: string[]): Promise<string> {
  const cmd = [
    'docker exec',
    '--user=$(id -u)',
    'bitcoind-regtest',
    'bitcoin-cli',
    '-regtest',
    `-datadir=${DATADIR}`,
    `-rpcuser=${RPC_USER}`,
    `-rpcpassword=${RPC_PASSWORD}`,
    `-rpcport=${RPC_PORT}`,
    ...args
  ].join(' ');

  const { stdout } = await execAsync(cmd);
  return stdout.trim();
}

// Setup regtest by
// - Creating a wallet
// - Getting a new address
// - Generating 101 blocks to that address
export async function setupRegtestWallet(): Promise<void> {
  await runBitcoinCli(['createwallet', 'testwallet']);
  addr = await runBitcoinCli(['getnewaddress']);
  await runBitcoinCli(['generatetoaddress', '101', addr]);
}

// mineBlocks mines the given number of blocks to the regtest wallet address.
// This is useful to confirm transactions in tests.
export async function mineBlocks(numBlocks: number): Promise<void> {
  await runBitcoinCli(['generatetoaddress', numBlocks.toString(), addr]);
}

/**
 * Send coins to a given address in the regtest wallet.
 * @param address The address to send to
 * @param amount The amount in BTC
 */
export async function sendCoins(address: string, amount: number | string): Promise<string> {
  // bitcoin-cli expects amount as a string with decimal point
  const amt = typeof amount === 'number' ? amount.toFixed(8) : amount;
  const txid = await runBitcoinCli(['sendtoaddress', address, amt]);
  return txid; // returns the transaction ID
}


export function launchRegtest(): Promise<ChildProcess> {
  const PROJECT_ROOT = process.env.GITHUB_WORKSPACE || path.resolve(__dirname, '../../../..');
  // First, clean up cache and headers.
  try {
    const basePath = path.join(PROJECT_ROOT, 'appfolder.dev/cache');

    // Remove headers-rbtc.bin if it exists
    const headersPath = path.join(basePath, 'headers-rbtc.bin');
    if (fs.existsSync(headersPath)) {
      fs.rmSync(headersPath, { force: true });
      console.log(`Removed: ${headersPath}`);
    }
    if (fs.existsSync(basePath)) {
      // Remove all account-*rbtc* directories
      const entries = fs.readdirSync(basePath);
      for (const entry of entries) {
        if (/^account-.*rbtc/i.test(entry)) {
          const dirPath = path.join(basePath, entry);
          fs.rmSync(dirPath, { recursive: true, force: true });
          console.log(`Removed directory: ${dirPath}`);
        }
      }
    }
  } catch (err) {
    console.warn('Warning: Failed to clean up cache or headers before regtest launch:', err);
  }
  const scriptPath = path.join(PROJECT_ROOT, 'scripts/run_regtest.sh');

  return new Promise((resolve, reject) => {
    const proc = spawn('bash', [scriptPath], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'], // capture stdout/stderr
    });

    // Listen for the line we want
    const onData = (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(text); // still print it to console
      if (text.includes('waiting for 0 blocks to download (IBD)')) {
        proc.stdout.off('data', onData);
        proc.stderr.off('data', onData);
        resolve(proc); // resolve when we see the line
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('error', reject);
  });
}


/**
 * Cleans up all regtest-related processes and Docker containers.
 *
 * @param regtest The ChildProcess returned by launchRegtest()
 */
export async function cleanupRegtest(
  regtest?: ChildProcess,
): Promise<void> {
  console.log('Cleaning up regtest environment');


  // Kill the regtest process group (spawned as detached)
  if (regtest?.pid) {
    try {
      process.kill(-regtest.pid, 'SIGTERM');
    } catch (err) {
      console.warn('Failed to kill regtest process:', err);
    }
  }


  // Remove Docker containers
  try {
    await execAsync(`
docker container rm -f bitcoind-regtest electrs-regtest1 electrs-regtest2 >/dev/null 2>&1 || true
`);
    console.log('Docker containers cleaned up.');
  } catch (err) {
    console.warn('Docker cleanup failed:', err);
  }


  // Remove regtest data directories
  const dirs = [
    '/tmp/regtest/btcdata',
    '/tmp/regtest/electrsdata1',
    '/tmp/regtest/electrsdata2',
  ];

  for (const dir of dirs) {
    try {
      await execAsync(`rm -rf ${dir}`);
      console.log(`Deleted directory: ${dir}`);
    } catch (err) {
      console.warn(`Failed to delete directory ${dir}:`, err);
    }
  }

}
