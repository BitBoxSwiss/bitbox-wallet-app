#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// New licenses and SPDX expressions require review before being added here.
const allowedLicenses = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MIT',
  '(Apache-2.0 AND MIT)',
  '(BSD-3-Clause OR GPL-2.0)', // Use the BSD-3-Clause option.
]);

const { packages: expectedLicenses, exceptions } = JSON.parse(
  readFileSync(new URL('../licenses.json', import.meta.url), 'utf8')
);

// Run via npm run check-licenses after npm ci. Read installed manifests because
// older lockfile entries lack license metadata. npm lists each physical package
// once, including nested versions and transitive dependencies.
const paths = execFileSync(process.execPath, [
  process.env.npm_execpath,
  'list', '--omit=dev', '--all', '--parseable',
], { cwd: new URL('../', import.meta.url), encoding: 'utf8' })
  .trim().split(/\r?\n/).slice(1); // The first path is the app itself.

for (const packagePath of paths) {
  const { name, version, license } = JSON.parse(
    readFileSync(join(packagePath, 'package.json'), 'utf8')
  );
  if (typeof license !== 'string' || (!allowedLicenses.has(license) && exceptions[name] !== license)) {
    console.error(`${name}@${version}: unapproved license ${JSON.stringify(license) ?? '(missing)'} (${packagePath})`);
    process.exitCode = 1;
  }
  if (expectedLicenses[name] !== license) {
    console.error(`${name}@${version}: license differs from licenses.json: expected ${JSON.stringify(expectedLicenses[name]) ?? '(not recorded)'}, found ${JSON.stringify(license) ?? '(missing)'} (${packagePath})`);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  console.error('Revert the dependency change or review its license before updating licenses.json. See docs/dependency-licenses.md.');
}

if (!process.exitCode) {
  console.log(`License check passed for ${paths.length} production dependencies.`);
}
