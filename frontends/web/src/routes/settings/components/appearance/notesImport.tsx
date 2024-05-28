/**
 * Copyright 2024 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useRef, useState } from 'react';
import { importNotes } from '../../../../api/backend';
import { alertUser } from '../../../../components/alert/Alert';

export const NotesImport = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDisabled, setImportDisabled] = useState<boolean>(true);

  return (
    <form id="uploadForm">
      <input
        type="file"
        name="file"
        ref={fileInputRef}
        onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
          setImportDisabled(e.target.files === null || e.target.files.length === 0);
        }}
      />
      <button
        type="button"
        disabled={importDisabled}
        onClick={async () => {
          if (fileInputRef.current === null) {
            return false;
          }
          const fileInput = fileInputRef.current;
          try {
            setImportDisabled(true);
            const file = fileInput.files![0];
            if (file.size > 10 * 1024 * 1024) {
              alertUser('File too large.');
              return false;
            }

            const result = await importNotes(await file.arrayBuffer());
            if (result.success) {
              // TODO add i18n key
              alertUser(`Imported ${result.data.accountCount} account names and ${result.data.transactionCount} transaction notes.`);
              fileInput.value = '';
            } else if (result.message) {
              alertUser(result.message);
            }
            return false;
          } finally {
            setImportDisabled(fileInput.files === null || fileInput.files.length === 0);
          }
        }}
      >Import</button>
    </form>
  );
};
