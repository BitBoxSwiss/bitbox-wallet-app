/**
 *  Copyright 2025 Shift Crypto AG
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

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
