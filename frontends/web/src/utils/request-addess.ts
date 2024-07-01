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

import { V0MessageScriptType } from 'request-address';
import { ScriptType } from '@/api/account';


// convertScriptType converts a V0MessageScriptType script type (https://www.npmjs.com/package/request-address#v0messagescripttype)
// into a ScriptType, as defined in api/account.ts.
export const convertScriptType = (scriptType: V0MessageScriptType): ScriptType => {
  if (scriptType === V0MessageScriptType.P2SH) {
    return 'p2wpkh-p2sh';
  }

  return scriptType as ScriptType;
};
