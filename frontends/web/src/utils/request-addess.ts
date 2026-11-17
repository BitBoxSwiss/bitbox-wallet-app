// SPDX-License-Identifier: Apache-2.0

import { V0MessageScriptType, type Slip24 as TRequestAddressSlip24 } from 'request-address';
import { ScriptType, type Slip24 } from '@/api/account';


// convertScriptType converts a V0MessageScriptType script type (https://www.npmjs.com/package/request-address#v0messagescripttype)
// into a ScriptType, as defined in api/account.ts.
export const convertScriptType = (scriptType: V0MessageScriptType): ScriptType => {
  if (scriptType === V0MessageScriptType.P2SH) {
    return 'p2wpkh-p2sh';
  }

  return scriptType as ScriptType;
};

// request-address encodes refunds as strings; the backend uses refund objects.
export const convertSlip24 = (slip24: TRequestAddressSlip24): Slip24 => ({
  ...slip24,
  memos: slip24.memos.map(memo => memo.type === 'refund'
    ? { type: memo.type, refund: { address: memo.refund } }
    : memo),
});
