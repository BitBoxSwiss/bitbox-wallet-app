// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('checks production licenses and package-specific exceptions', () => {
  const root = mkdtempSync(join(tmpdir(), 'bitbox-licenses-'));
  const writePackage = (path, manifest) => {
    mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, path, 'package.json'), JSON.stringify(manifest));
  };
  const nestedPath = 'node_modules/parent/node_modules/shared';
  const run = () => spawnSync(process.execPath, [join(root, 'scripts/check-licenses.mjs')], {
    encoding: 'utf8',
  });

  try {
    mkdirSync(join(root, 'scripts'));
    const script = readFileSync('scripts/check-licenses.mjs', 'utf8')
      .replace('const exceptions = {};', 'const exceptions = { shared: \'GPL-2.0\' };');
    writeFileSync(join(root, 'scripts/check-licenses.mjs'), script);
    writePackage('', {
      name: 'app', version: '1.0.0',
      dependencies: { parent: '1.0.0', shared: '1.0.0' },
      devDependencies: { tooling: '1.0.0' },
    });
    writePackage('node_modules/parent', {
      name: 'parent', version: '1.0.0', license: 'Apache-2.0',
      dependencies: { shared: '2.0.0' },
    });
    writePackage('node_modules/tooling', { name: 'tooling', version: '1.0.0', license: 'UNLICENSED' });

    for (const license of ['MIT', '(Apache-2.0 AND MIT)', '(BSD-3-Clause OR GPL-2.0)']) {
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

    writePackage('node_modules/shared', { name: 'shared', version: '1.0.0', license: 'MIT' });

    // GPL-3.0 also shows the exception approves no other license.
    for (const license of ['SEE LICENSE IN LICENSE.md', 'UNLICENSED', 'GPL-3.0', '(MIT AND GPL-2.0)', undefined]) {
      writePackage(nestedPath, { name: 'shared', version: '2.0.0', license });
      const result = run();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('shared@2.0.0: unapproved license');
      expect(result.stdout).not.toContain('passed');
    }

    writePackage('node_modules/shared', { name: 'shared', version: '1.0.0', license: 'GPL-2.0' });
    writePackage(nestedPath, { name: 'shared', version: '2.0.0', license: 'GPL-2.0' });
    const excepted = run();
    expect(excepted.status, excepted.stderr).toBe(0);

    // The exception approves no other package.
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
