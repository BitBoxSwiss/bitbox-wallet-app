#!/usr/bin/env node

/**
 * Sort all keys in JSON files alphabetically (recursively).
 *
 * Usage:
 *   node ./scripts/sort-json.mjs ./src/locales
 *   node ./scripts/sort-json.mjs ./src/locales/en/common.json
 *
 * Features:
 * - Recursively scans directories
 * - Only processes .json files
 * - Sorts keys alphabetically at every nesting level
 * - Preserves array order
 * - Pretty prints with 2-space indentation
 * - Adds trailing newline
 * - Deterministic sorting
 */

import fs from 'fs';
import path from 'path';

const ACCEPTED_EXTENSION = '.json';

const getJsonFiles = (targetPath) => {
  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    return path.extname(targetPath) === ACCEPTED_EXTENSION
      ? [targetPath]
      : [];
  }

  let files = [];

  for (const entry of fs.readdirSync(targetPath)) {
    const fullPath = path.join(targetPath, entry);
    const entryStat = fs.statSync(fullPath);

    if (entryStat.isDirectory()) {
      files = files.concat(getJsonFiles(fullPath));
    } else if (path.extname(fullPath) === ACCEPTED_EXTENSION) {
      files.push(fullPath);
    }
  }

  return files;
};

const sortObject = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(value[key]);
        return acc;
      }, {});
  }

  return value;
};

const processFile = (filePath) => {
  try {
    const original = fs.readFileSync(filePath, 'utf8');

    if (!original.trim()) {
      console.log(`Skipped empty file: ${filePath}`);
      return;
    }

    const parsed = JSON.parse(original);
    const sorted = sortObject(parsed);

    const output = `${JSON.stringify(sorted, null, 2)}\n`;

    if (output !== original) {
      fs.writeFileSync(filePath, output, 'utf8');
      console.log(`Sorted: ${filePath}`);
    } else {
      console.log(`Already sorted: ${filePath}`);
    }
  } catch (error) {
    console.error(`Failed: ${filePath}`);
    console.error(error.message);
  }
};

const main = () => {
  const target = process.argv[2];

  if (!target) {
    console.error('Usage: node sort-json <file-or-directory>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(target);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Path does not exist: ${resolvedPath}`);
    process.exit(1);
  }

  const files = getJsonFiles(resolvedPath);

  if (files.length === 0) {
    console.log('No JSON files found.');
    return;
  }

  files.forEach(processFile);

  console.log('FINISHED');
  process.exit(0);

};

main();
