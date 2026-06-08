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

/**
 * Returns a full path for a log file in the provided Playwright output directory.
 * Automatically creates the folder if it doesn't exist.
 *
 * @param outputDir - Playwright's per-test output directory
 * @param logFileName - The log filename (e.g., 'backend.log' or 'simulator.log')
 */
export function getLogFilePath(outputDir: string, logFileName: string): string {
  const folderPath = path.resolve(outputDir);
  fs.mkdirSync(folderPath, { recursive: true });

  return path.join(folderPath, logFileName);
}
