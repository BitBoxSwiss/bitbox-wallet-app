// SPDX-License-Identifier: Apache-2.0

export type TSuccessResponse = {
  success: true;
};

// if the backend uses maybeBB02Err
export type TFailResponse = {
  code?: number;
  message?: string;
  success: false;
};

// In other places we use type { TFailResponse, TSuccessResponse } from './response'
// which has slightly different TFailResponse structure ( message?: string; code?: number)
// but here we use errorMessage and errorCode instead
export type TSuccess = {
  success: boolean;
  errorMessage?: string;
  errorCode?: string;
};
