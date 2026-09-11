#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import semver from 'semver';

const FIRST_COMMUNITY_LICENSED_VERSION = {
  '@reown/walletkit': '1.2.11',
  '@walletconnect/core': '2.21.9',
  '@walletconnect/sign-client': '2.21.9',
  '@walletconnect/types': '2.21.9',
  '@walletconnect/utils': '2.21.9',
};

const { packages } = JSON.parse(
  readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')
);

for (const [packagePath, { version }] of Object.entries(packages)) {
  const policy = Object.entries(FIRST_COMMUNITY_LICENSED_VERSION).find(
    ([packageName]) => packagePath.endsWith(`node_modules/${packageName}`)
  );

  if (policy && semver.gte(version, policy[1])) {
    console.error(
      `WalletConnect Community License version found: ${policy[0]}@${version}`
    );
    process.exit(1);
  }
}

console.log('WalletConnect dependencies remain on Apache-2.0 versions.');
process.exit(0);
