// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('checks production licenses, license changes, and package-specific exceptions', () => {
  const root = mkdtempSync(join(tmpdir(), 'bitbox-licenses-'));
  const writePackage = (path, manifest) => {
    mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, path, 'package.json'), JSON.stringify(manifest));
  };
  const nestedPath = 'node_modules/parent/node_modules/shared';
  const policy = { exceptions: {}, packages: { parent: 'Apache-2.0', shared: 'MIT' } };
  const writePolicy = () => writeFileSync(join(root, 'licenses.json'), JSON.stringify(policy));
  const run = () => spawnSync(process.execPath, [join(root, 'scripts/check-licenses.mjs')], {
    encoding: 'utf8',
  });

  try {
    mkdirSync(join(root, 'scripts'));
    copyFileSync('scripts/check-licenses.mjs', join(root, 'scripts/check-licenses.mjs'));
    writePackage('', {
      name: 'app', version: '1.0.0',
      dependencies: { parent: '1.0.0', shared: '1.0.0' },
      devDependencies: { tooling: '1.0.0' },
    });
    writePackage('node_modules/parent', {
      name: 'parent', version: '1.0.0', license: 'Apache-2.0',
      dependencies: { shared: '2.0.0' },
    });
    writePackage('node_modules/shared', { name: 'shared', version: '1.0.0', license: 'MIT' });
    writePackage('node_modules/tooling', { name: 'tooling', version: '1.0.0', license: 'UNLICENSED' });

    for (const license of ['MIT', '(Apache-2.0 AND MIT)', '(BSD-3-Clause OR GPL-2.0)']) {
      policy.packages.shared = license;
      writePolicy();
      writePackage('node_modules/shared', { name: 'shared', version: '1.0.0', license });
      writePackage(nestedPath, { name: 'shared', version: '2.0.0', license });
      const result = run();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('3 production dependencies');
    }

    // Remove a required dependency from the passing fixture.
    rmSync(join(root, 'node_modules/shared'), { recursive: true });
    const missingDependency = run();
    expect(missingDependency.status).toBe(1);
    expect(missingDependency.stderr).toContain('missing: shared@1.0.0');
    expect(missingDependency.stdout).not.toContain('passed');

    policy.packages.shared = 'MIT';
    writePolicy();
    writePackage('node_modules/shared', { name: 'shared', version: '1.0.0', license: 'MIT' });

    for (const license of ['SEE LICENSE IN LICENSE.md', 'UNLICENSED', 'GPL-2.0', '(MIT AND GPL-2.0)', undefined]) {
      writePackage(nestedPath, { name: 'shared', version: '2.0.0', license });
      const result = run();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('shared@2.0.0: unapproved license');
      expect(result.stdout).not.toContain('passed');
    }

    writePackage(nestedPath, { name: 'shared', version: '2.0.0', license: 'Apache-2.0' });
    const changedLicense = run();
    expect(changedLicense.status).toBe(1);
    expect(changedLicense.stderr).toContain('expected "MIT", found "Apache-2.0"');
    expect(changedLicense.stderr).not.toContain('unapproved license');

    writePackage(nestedPath, { name: 'shared', version: '2.0.0', license: 'MIT' });
    delete policy.packages.shared;
    writePolicy();
    const unrecorded = run();
    expect(unrecorded.status).toBe(1);
    expect(unrecorded.stderr).toContain('expected (not recorded), found "MIT"');

    policy.exceptions.shared = 'GPL-2.0';
    policy.packages.shared = 'GPL-2.0';
    writePolicy();
    writePackage('node_modules/shared', { name: 'shared', version: '1.0.0', license: 'GPL-2.0' });
    writePackage(nestedPath, { name: 'shared', version: '2.0.0', license: 'GPL-2.0' });
    const excepted = run();
    expect(excepted.status, excepted.stderr).toBe(0);

    // The exception approves neither another license nor another package.
    policy.packages.shared = 'GPL-3.0';
    writePolicy();
    writePackage(nestedPath, { name: 'shared', version: '2.0.0', license: 'GPL-3.0' });
    const otherLicense = run();
    expect(otherLicense.status).toBe(1);
    expect(otherLicense.stderr).toContain('shared@2.0.0: unapproved license "GPL-3.0"');

    policy.packages.parent = 'GPL-2.0';
    writePolicy();
    writePackage('node_modules/parent', {
      name: 'parent', version: '1.0.0', license: 'GPL-2.0',
      dependencies: { shared: '2.0.0' },
    });
    const otherPackage = run();
    expect(otherPackage.status).toBe(1);
    expect(otherPackage.stderr).toContain('parent@1.0.0: unapproved license "GPL-2.0"');

    writePackage(nestedPath, { name: 'shared', version: '2.0.0', license: 'MIT' });
    writePackage('node_modules/shared', { name: 'shared', version: '1.0.0', license: 'UNLICENSED' });
    expect(run().stderr).toContain('shared@1.0.0: unapproved license');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);
