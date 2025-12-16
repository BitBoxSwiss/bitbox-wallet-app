// SPDX-License-Identifier: Apache-2.0

import type { SuccessResponse } from './response';
import { apiPost } from '@/utils/request';

type TCertResponse = {
  success: true;
  pemCert: string;
} | {
  success: false;
  errorMessage: string;
};

export const downloadCert = (electrumServer: string): Promise<TCertResponse> => {
  return apiPost('certs/download', electrumServer);
};

export type TElectrumServer = {
  server: string;
  tls: boolean;
  pemCert: string;
};

type TCheckElectrumResponse = SuccessResponse | {
  success: false;
  errorMessage: string;
};

export const checkElectrum = (server: TElectrumServer): Promise<TCheckElectrumResponse> => {
  return apiPost('electrum/check', server);
};
