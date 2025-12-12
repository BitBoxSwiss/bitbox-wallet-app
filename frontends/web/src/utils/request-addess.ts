// SPDX-License-Identifier: Apache-2.0

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
