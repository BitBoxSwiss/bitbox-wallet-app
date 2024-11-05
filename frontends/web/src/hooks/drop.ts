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

const sha256 = async (content: ArrayBuffer) => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const onDrop = (event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  const files: FileList | undefined = event.dataTransfer?.files;
  if (!files || !files.length) {
    return;
  }
  const shasums: string[] = [];
  for (const file of files) {
    if (
      file.name.endsWith('.apk') // a use might check the apk on a laptop
      || file.name.endsWith('.deb')
      || file.name.endsWith('.dmg')
      || file.name.endsWith('.exe')
      || file.name.endsWith('.rpm')
      || file.name.endsWith('.zip')
    ) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result;
        if (content instanceof ArrayBuffer) {
          try {
            const shasum = await sha256(content);
            if (shasum) {
              shasums.push(`SHA256 checksum for:\n${file.name}\n${shasum}\n`);
            } else {
              shasums.push(`Could not find SHA256 checksum for ${file.name}\n`);
            }
          } catch (error) {
            shasums.push(`Error trying to find SHA256 checksum for ${file.name}: ${error}\n`);
          } finally {
            if (shasums.length === files.length) {
              alert(shasums.join('\n'));
            }
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      shasums.push('');
    }
  }
};

/**
 * Ignore files that are dropped into the window
 */
export const useDrop = () => {
  window.addEventListener('dragover', onDrop);
  window.addEventListener('drop', onDrop);
  return () => {
    window.removeEventListener('dragover', onDrop);
    window.removeEventListener('drop', onDrop);
  };
};
