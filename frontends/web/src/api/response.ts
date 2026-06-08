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
