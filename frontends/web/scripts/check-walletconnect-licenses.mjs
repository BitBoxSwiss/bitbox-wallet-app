#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const FIRST_COMMUNITY_LICENSED_VERSION = {
  '@reown/walletkit': '1.2.11',
  '@walletconnect/core': '2.21.9',
  '@walletconnect/sign-client': '2.21.9',
  '@walletconnect/types': '2.21.9',
  '@walletconnect/utils': '2.21.9',
};

const versionParts = (version) => {
  const match = /^\d+\.\d+\.\d+/.exec(version);
  if (!match) {
    throw new Error(`Invalid package version: ${version}`);
  }
  return match[0].split('.').map(Number);
};

const isAtLeast = (version, minimum) => {
  const actual = versionParts(version);
  const boundary = versionParts(minimum);
  const difference = actual.findIndex(
    (part, index) => part !== boundary[index]
  );
  return difference === -1 || actual[difference] > boundary[difference];
};

const { packages } = JSON.parse(
  readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')
);

for (const [packagePath, { version }] of Object.entries(packages)) {
  const policy = Object.entries(FIRST_COMMUNITY_LICENSED_VERSION).find(
    ([packageName]) => packagePath.endsWith(`node_modules/${packageName}`)
  );

  if (policy && isAtLeast(version, policy[1])) {
    console.error(
      `WalletConnect Community License version found: ${policy[0]}@${version}`
    );
    process.exit(1);
  }
}

console.log('WalletConnect dependencies remain on Apache-2.0 versions.');
