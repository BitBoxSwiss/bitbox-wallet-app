#!/usr/bin/env node

/**
 * Sort all keys in JSON files alphabetically (recursively).
 *
 * Usage:
 *   Sort mode:
 *     node ./scripts/sort-json.mjs ./src/locales
 *
 *   Check/lint mode:
 *     node ./scripts/sort-json.mjs ./src/locales --check
 *
 * Features:
 * - Recursively scans directories
 * - Only processes .json files
 * - Sorts keys alphabetically at every nesting level
 * - Preserves array order
 * - Pretty prints with 2-space indentation
 * - Adds trailing newline
 * - Deterministic sorting
 * - --check mode is a dry run without modifying any files to check that all files are sorted alphabetically, fails with exits with code 1 in case some files are not sorted
 */

import fs from 'fs';
import path from 'path';

const ACCEPTED_EXTENSION = '.json';

const getJsonFiles = (targetPath) => {
  let files = [];

  let stat;
  try {
    stat = fs.statSync(targetPath);
  } catch (err) {
    console.error(`Cannot access path: ${targetPath}`);
    console.error(err.message);
    return files;
  }

  if (stat.isFile()) {
    return path.extname(targetPath) === ACCEPTED_EXTENSION
      ? [targetPath]
      : [];
  }

  let entries;
  try {
    entries = fs.readdirSync(targetPath);
  } catch (err) {
    console.error(`Cannot read directory: ${targetPath}`);
    console.error(err.message);
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry);

    let entryStat;
    try {
      entryStat = fs.statSync(fullPath);
    } catch (err) {
      console.error(`Cannot stat: ${fullPath}`);
      console.error(err.message);
      continue;
    }

    try {
      if (entryStat.isDirectory()) {
        files = files.concat(getJsonFiles(fullPath));
      } else if (entryStat.isFile() && path.extname(fullPath) === ACCEPTED_EXTENSION) {
        files.push(fullPath);
      }
    } catch (err) {
      console.error(`Error processing: ${fullPath}`);
      console.error(err.message);
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

const processFile = (filePath, checkMode) => {
  try {
    const original = fs.readFileSync(filePath, 'utf8');

    if (!original.trim()) {
      console.log(`Skipped empty file: ${filePath}`);
      return false;
    }

    const parsed = JSON.parse(original);
    const sorted = sortObject(parsed);

    const output = `${JSON.stringify(sorted, null, 2)}\n`;

    const changed = output !== original;

    if (checkMode) {
      if (changed) {
        console.error(`Not sorted: ${filePath}`);
      } else {
        console.log(`OK: ${filePath}`);
      }

      return changed;
    }

    if (changed) {
      fs.writeFileSync(filePath, output, 'utf8');
      console.log(`Sorted: ${filePath}`);
    } else {
      console.log(`Already sorted: ${filePath}`);
    }

    return false;
  } catch (error) {
    console.error(`Failed: ${filePath}`);
    console.error(error.message);
    process.exit(1);
  }
};

const main = () => {
  const target = process.argv[2];
  const checkMode = process.argv.includes('--check');

  if (!target) {
    console.error(
      'Usage: node ./scripts/sort-json.mjs <file-or-directory> [--check]'
    );
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
    process.exit(0);
  }

  let hasChanges = false;

  files.forEach((file) => {
    const changed = processFile(file, checkMode);

    if (changed) {
      hasChanges = true;
    }
  });

  if (checkMode && hasChanges) {
    console.error('Not all JSON files are sorted!');
    process.exit(1);
  }

  console.log('FINISHED');
  process.exit(0);
};

main();
