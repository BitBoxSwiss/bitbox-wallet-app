const fs = require('fs');
const path = require('path');

const simulatorsPath = path.resolve(
  process.env.SIMULATORS_JSON || 'backend/devices/bitbox02/testdata/simulators.json'
);
const minVersion = process.env.MIN_FIRMWARE_VERSION || 'v9.24.0';
const outputKind = process.env.OUTPUT_KIND || 'matrix';
const versionPattern = /firmware%2F(v\d+\.\d+\.\d+)\//;

const parseVersion = (version) => version.replace(/^v/, '').split('.').map((part) => Number(part));

const compareVersions = (left, right) => {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
};

const allSimulators = JSON.parse(fs.readFileSync(simulatorsPath, 'utf8'))
  .map(({ url, sha256 }) => {
    const match = url.match(versionPattern);
    if (!match) {
      throw new Error(`Could not extract firmware version from simulator URL: ${url}`);
    }

    return {
      version: match[1],
      url,
      sha256,
    };
  })
  .sort((left, right) => compareVersions(left.version, right.version));

if (allSimulators.length === 0) {
  throw new Error(`No simulators found in ${simulatorsPath}`);
}

const simulators = allSimulators.filter(({ version }) => compareVersions(version, minVersion) >= 0);

if (simulators.length === 0) {
  throw new Error(`No simulators found at or above ${minVersion} in ${simulatorsPath}`);
}

const matrix = JSON.stringify({ simulator: simulators });
const latestSimulator = allSimulators[allSimulators.length - 1];

if (process.env.GITHUB_OUTPUT) {
  if (outputKind === 'latest') {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${latestSimulator.version}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `url=${latestSimulator.url}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sha256=${latestSimulator.sha256}\n`);
  } else {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${matrix}\n`);
  }
} else {
  if (outputKind === 'latest') {
    process.stdout.write(`${JSON.stringify(latestSimulator)}\n`);
  } else {
    process.stdout.write(`${matrix}\n`);
  }
}
