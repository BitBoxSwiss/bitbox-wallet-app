
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
      .replace(/^http:\/\//, 'https://')
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

const grouped = new Map();

for (const packagePath of paths) {
  const {
    name,
    version,
    license,
    repository,
  } = JSON.parse(
    readFileSync(join(packagePath, 'package.json'), 'utf8')
  );

  const licenseText = getLicenseText(packagePath);

  if (!licenseText) {
    console.warn(`Missing license file: ${name}@${version}`);
  }

  const normalizedLicense = license ?? null;
  const normalizedRepository = getRepository(repository);

  // Group packages only when all license-related metadata matches.
  const key = JSON.stringify([
    name,
    normalizedLicense,
    normalizedRepository,
    licenseText,
  ]);

  if (grouped.has(key)) {
    grouped.get(key).versions.add(version);
  } else {
    grouped.set(key, {
      name,
      versions: new Set([version]),
      license: normalizedLicense,
      repository: normalizedRepository,
      licenseText,
    });
  }
}

// Convert version sets to sorted arrays.
const dependencies = Array.from(grouped.values(), dependency => ({
  ...dependency,
  versions: [...dependency.versions].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  ),
}));

// Ensure deterministic output.
dependencies.sort((a, b) => (
  a.name.localeCompare(b.name)
  || a.versions[0].localeCompare(b.versions[0], undefined, { numeric: true })
  || a.licenseText?.localeCompare(b.licenseText ?? '')
  || 0
));

mkdirSync(join(root, 'public'), { recursive: true });

writeFileSync(
  output,
  JSON.stringify(dependencies, null, 2) + '\n',
  'utf8'
);

const versionCount = dependencies.reduce(
  (count, dependency) => count + dependency.versions.length,
  0
);

console.log(
  `Generated ${output} (${dependencies.length} license entries, ${versionCount} package versions)`
);
