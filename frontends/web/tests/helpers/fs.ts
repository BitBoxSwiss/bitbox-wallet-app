// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';

export function deleteAccountsFile() {
  const filePath = path.join(process.cwd(), '../../appfolder.dev/accounts.json');
  deleteFile(filePath);
}


export function deleteConfigFile() {
  const filePath = path.join(process.cwd(), '../../appfolder.dev/config.json');
  deleteFile(filePath);
}

function deleteFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  } else {
    console.warn(`File ${filePath} does not exist, skipping removal.`);
  }

}

function sanitizeFileName(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
}


/**
 * Returns a full path for a log file in test-results/<test>-<project>/
 * Automatically creates the folder if it doesn't exist.
 *
 * @param testName - Current test name
 * @param projectName - Playwright project name
 * @param logFileName - The log filename (e.g., 'backend.log' or 'simulator.log')
 */
export function getLogFilePath(testName: string, projectName: string, logFileName: string): string {
  const safeTest = sanitizeFileName(testName);
  const safeProject = sanitizeFileName(projectName);

  const folderPath = path.resolve(process.cwd(), 'test-results', `${safeTest}-${safeProject}`);
  fs.mkdirSync(folderPath, { recursive: true });

  return path.join(folderPath, logFileName);
}
