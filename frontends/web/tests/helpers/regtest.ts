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
const BITCOIND_CONTAINER = 'bitcoind-regtest';
const ELECTRS_CONTAINER1 = 'electrs-regtest1';
const ELECTRS_CONTAINER2 = 'electrs-regtest2';
const BITCOIND_VOLUME = 'bitcoind-regtest-data';
const ELECTRS_VOLUME1 = 'electrs-regtest-data1';
const ELECTRS_VOLUME2 = 'electrs-regtest-data2';
const BTC_DATA_DIR = '/tmp/regtest/btcdata';
const ELECTRS_DATA_DIR1 = '/tmp/regtest/electrsdata1';
const ELECTRS_DATA_DIR2 = '/tmp/regtest/electrsdata2';

let addr: string;

// run bitcoin-cli command inside the bitcoind-regtest docker container.
async function runBitcoinCli(args: string[]): Promise<string> {
  const cmd = [
    'docker exec',
    '--user=$(id -u)',
    BITCOIND_CONTAINER,
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

async function cleanupRegtestResources(): Promise<void> {
  try {
    await execAsync(`
docker container rm -f ${BITCOIND_CONTAINER} ${ELECTRS_CONTAINER1} ${ELECTRS_CONTAINER2} >/dev/null 2>&1 || true
`);
  } catch (err) {
    console.warn('Docker cleanup failed:', err);
  }

  try {
    await execAsync(`
docker volume rm -f ${BITCOIND_VOLUME} ${ELECTRS_VOLUME1} ${ELECTRS_VOLUME2} >/dev/null 2>&1 || true
`);
  } catch (err) {
    console.warn('Docker volume cleanup failed:', err);
  }

  for (const dir of [BTC_DATA_DIR, ELECTRS_DATA_DIR1, ELECTRS_DATA_DIR2]) {
    try {
      await execAsync(`rm -rf ${dir}`);
    } catch (err) {
      console.warn(`Failed to delete directory ${dir}:`, err);
    }
  }
}

export async function launchRegtest(): Promise<ChildProcess> {
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

  await cleanupRegtestResources();

  const scriptPath = path.join(PROJECT_ROOT, 'scripts/run_regtest.sh');

  return new Promise((resolve, reject) => {
    const proc = spawn('bash', [scriptPath], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'], // capture stdout/stderr
    });
    let settled = false;
    let startupOutput = '';

    const cleanupListeners = () => {
      proc.stdout.off('data', onData);
      proc.stderr.off('data', onData);
      proc.off('error', onError);
      proc.off('exit', onExit);
    };

    // Listen for the line we want
    const onData = (data: Buffer) => {
      const text = data.toString();
      startupOutput += text;
      process.stdout.write(text); // still print it to console
      if (text.includes('waiting for 0 blocks to download (IBD)')) {
        settled = true;
        cleanupListeners();
        resolve(proc); // resolve when we see the line
      }
    };

    const onError = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupListeners();
      reject(error);
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupListeners();
      const details = startupOutput.trim();
      reject(new Error(
        `Regtest launcher exited before ready (code=${String(code)}, signal=${String(signal)}).` +
        (details ? ` Output:\n${details}` : '')
      ));
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', onError);
    proc.on('exit', onExit);
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

  await cleanupRegtestResources();
}
