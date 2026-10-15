
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'public/licenses-npm.json');

// Get all transitive production dependencies.
const paths = (
  execFileSync(process.execPath, [
    process.env.npm_execpath,
    'list', '--omit=dev', '--all', '--parseable',
  ], { cwd: root, encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .slice(1) // drop the first entry which is the project root
);

// Find the package's license file.
function getLicenseText(packagePath) {
  const licenseFile = (
    readdirSync(packagePath)
      .find(file => /^(LICENSE|LICENCE|COPYING)([.-].*)?$/i.test(file))
  );

  return (
    licenseFile
      ? readFileSync(join(packagePath, licenseFile), 'utf8')
      : null
  );
}

// Normalize repository metadata.
function getRepository(repository) {
  if (!repository) {
    return null;
  }

  const url = (
    typeof repository === 'string'
      ? repository
      : repository.url
  );

  if (!url) {
    return null;
  }

  // Convert common Git repository URL formats into browser-friendly HTTPS URLs.
  // This allows repository links to be displayed directly in the license UI.
  const normalized = (
    url
      .replace(/^git\+/, '')
      .replace(/^git@github\.com:/, 'https://github.com/')
      .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
      .replace(/^git:\/\//, 'https://')
      .replace(/\.git$/, '')
  );

  const hosts = {
    github: 'github.com',
    gitlab: 'gitlab.com',
    bitbucket: 'bitbucket.org',
  };

  // Expand hosted Git shortcuts such as "gitlab:owner/repo".
  const [prefix, path] = normalized.split(':');

  if (hosts[prefix] && path) {
    return `https://${hosts[prefix]}/${path}`;
  }

  // npm defaults owner/repo shortcuts to GitHub.
  if (/^[\w.-]+\/[\w.-]+$/.test(normalized)) {
    return `https://github.com/${normalized}`;
  }

  return normalized;
}

const dependencies = [];
const seen = new Set();

for (const packagePath of paths) {
  const {
    name,
    version,
    license,
    repository,
  } = JSON.parse(
    readFileSync(join(packagePath, 'package.json'), 'utf8')
  );

  // The same package version may exist at multiple locations in node_modules.
  // Include each name/version combination only once in the license report.
  const key = `${name}@${version}`;
  if (seen.has(key)) {
    continue;
  }
  seen.add(key);

  const licenseText = getLicenseText(packagePath);

  if (!licenseText) {
    console.warn(`Missing license file: ${key}`);
  }

  dependencies.push({
    name,
    version,
    license: license ?? null,
    repository: getRepository(repository),
    licenseText,
  });
}

// Ensure deterministic output.
dependencies.sort((a, b) => (
  a.name.localeCompare(b.name)
  || a.version.localeCompare(b.version)
));

mkdirSync(join(root, 'public'), { recursive: true });

writeFileSync(
  output,
  JSON.stringify(dependencies, null, 2) + '\n',
  'utf8'
);

console.log(`Generated ${output} (${dependencies.length} dependencies)`);
