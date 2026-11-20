// SPDX-License-Identifier: Apache-2.0

export type SuccessResponse = {
  success: true;
};

// if the backend uses maybeBB02Err
export type FailResponse = {
  code?: number;
  message?: string;
  success: false;
};

// In other places we use type { FailResponse, SuccessResponse } from './response'
// which has slightly different FailResponse structure ( message?: string; code?: number)
// but here we use errorMessage and errorCode instead
export type TSuccess = {
  success: boolean;
  errorMessage?: string;
  errorCode?: string;
};
