// SPDX-License-Identifier: Apache-2.0

import { t } from 'i18next';
import { SessionTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { EIP155_SIGNING_METHODS, SUPPORTED_CHAINS, decodeEthMessage } from './walletconnect';
import type { AccountCode } from '@/api/account';
import {
  ethSignMessage,
  ethSignTypedMessage,
  ethSignWalletConnectTx,
  getEthAccountCodeAndNameByAddress,
} from '@/api/account';

type TWCParams = {
  request: {
    method: string;
    params: unknown;
  };
  chainId: unknown;
};

type TJsonRpcErrorReason = {
  code: number;
  message: string;
};

export type TJsonRpcResponse = {
  id: number;
  jsonrpc: '2.0';
  result: unknown;
} | {
  id: number;
  jsonrpc: '2.0';
  error: TJsonRpcErrorReason;
};

export type TRespondSessionRequest = (response: TJsonRpcResponse) => Promise<void>;

export type TEthSignHandlerParams = {
  id: number;
  params: TWCParams;
  currentSession?: SessionTypes.Struct;
  respond: TRespondSessionRequest;
  launchSignDialog: (request: TLaunchSignDialog) => boolean;
};

export type TRequestDialogContent = {
  accountName: string;
  accountAddress: string; // 'accountAddress' is the account's "receive" / "wallet" address
  displayAddress?: string;
  chain: string;
  signingData: string; // data / message coming from dapp
  currentSession: SessionTypes.Struct;
  method: string;
};

export type TSignDialogResult = {
  success: true;
} | {
  success: false;
  aborted?: boolean;
  errorMessage?: string;
};

export type TLaunchSignDialog = {
  accountCode: AccountCode;
  apiCaller: () => Promise<TSignDialogResult>;
  dialogContent: TRequestDialogContent;
  onReject: () => Promise<void>;
};

type TParsedChain = {
  caip2: string;
  id: bigint;
};

type TAccountDetails = {
  accountName: string;
  accountCode: string;
  displayAddress?: string;
};

type TFailedSigningApiResult = {
  success: false;
  aborted?: boolean;
  errorMessage?: string;
};

const UINT64_MAX = BigInt('18446744073709551615');
const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const APPLICATION_ERROR: TJsonRpcErrorReason = {
  code: -32000,
  message: 'Request failed.',
};
const INVALID_PARAMS: TJsonRpcErrorReason = {
  code: -32602,
  message: 'Invalid params.',
};
const TRANSACTION_REJECTED: TJsonRpcErrorReason = {
  code: -32003,
  message: 'Transaction rejected.',
};

const jsonRpcResult = (id: number, result: unknown): TJsonRpcResponse => ({
  id,
  jsonrpc: '2.0',
  result,
});

export const jsonRpcError = (
  id: number,
  error: TJsonRpcErrorReason,
): TJsonRpcResponse => ({
  id,
  jsonrpc: '2.0',
  error,
});

export const createSessionRequestResponder = (
  respond: TRespondSessionRequest,
): TRespondSessionRequest => {
  let responseAttempted = false;
  return async response => {
    if (responseAttempted) {
      return;
    }
    responseAttempted = true;
    try {
      await respond(response);
    } catch (error) {
      console.error('Failed to respond to WalletConnect request', error);
    }
  };
};

const parseRequestChain = (value: unknown): TParsedChain | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const match = /^eip155:(0|[1-9][0-9]*)$/.exec(value);
  if (!match) {
    return undefined;
  }
  const id = BigInt(match[1]!);
  if (id > UINT64_MAX) {
    return undefined;
  }
  return { caip2: `eip155:${id.toString()}`, id };
};

const isSupportedChain = (chain: string) =>
  Object.prototype.hasOwnProperty.call(SUPPORTED_CHAINS, chain);

const getApprovedChains = (namespace: SessionTypes.Namespace) => {
  if (namespace.chains) {
    return namespace.chains;
  }
  return namespace.accounts.flatMap(account => {
    const match = /^(eip155:(?:0|[1-9][0-9]*)):0x[0-9a-fA-F]{40}$/.exec(account);
    return match?.[1] ? [match[1]] : [];
  });
};

const isApprovedAccount = (
  namespace: SessionTypes.Namespace,
  chain: string,
  address: string,
) => namespace.accounts.some(account => {
  const match = /^(eip155:(?:0|[1-9][0-9]*)):(0x[0-9a-fA-F]{40})$/.exec(account);
  return match?.[1] === chain && match[2]?.toLowerCase() === address.toLowerCase();
});

const getAccountDetails = async (address: string): Promise<TAccountDetails | undefined> => {
  const accountDetail = await getEthAccountCodeAndNameByAddress(address);
  if (!accountDetail.success) {
    return undefined;
  }
  const { code, displayAddress, name } = accountDetail;
  return { accountName: name, accountCode: code, displayAddress };
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : t('pairing.error.text');

const runSigningApi = async <T extends { success: true }>(
  id: number,
  respond: TRespondSessionRequest,
  apiCall: () => Promise<T | TFailedSigningApiResult>,
  getResult: (result: T) => unknown,
): Promise<TSignDialogResult> => {
  try {
    const result = await apiCall();
    if (!result.success) {
      await respond(jsonRpcError(
        id,
        result.aborted ? getSdkError('USER_REJECTED') : APPLICATION_ERROR,
      ));
      return result;
    }

    await respond(jsonRpcResult(id, getResult(result as T)));
    return { success: true };
  } catch (error) {
    console.error('WalletConnect signing request failed', error);
    await respond(jsonRpcError(id, APPLICATION_ERROR));
    return { success: false, errorMessage: getErrorMessage(error) };
  }
};

const launchDialog = async (
  request: TLaunchSignDialog,
  id: number,
  respond: TRespondSessionRequest,
  launchSignDialog: TEthSignHandlerParams['launchSignDialog'],
) => {
  if (!launchSignDialog(request)) {
    await respond(jsonRpcError(id, APPLICATION_ERROR));
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const handleWcEthSignRequest = async (args: TEthSignHandlerParams) => {
  const { currentSession, id, params, respond } = args;
  try {
    const { method } = params.request;
    if (!Object.values(EIP155_SIGNING_METHODS).includes(method)) {
      await respond(jsonRpcError(id, getSdkError('UNSUPPORTED_METHODS')));
      return;
    }

    const requestChain = parseRequestChain(params.chainId);
    if (!requestChain) {
      await respond(jsonRpcError(id, INVALID_PARAMS));
      return;
    }
    if (!isSupportedChain(requestChain.caip2)) {
      await respond(jsonRpcError(id, getSdkError('UNSUPPORTED_CHAINS')));
      return;
    }
    if (!currentSession) {
      await respond(jsonRpcError(id, APPLICATION_ERROR));
      return;
    }

    const namespace = currentSession.namespaces.eip155;
    if (!namespace || !getApprovedChains(namespace).includes(requestChain.caip2)) {
      await respond(jsonRpcError(id, getSdkError('UNSUPPORTED_CHAINS')));
      return;
    }
    if (!namespace.methods.includes(method)) {
      await respond(jsonRpcError(id, getSdkError('UNAUTHORIZED_METHOD')));
      return;
    }

    const handlerArgs = { ...args, currentSession, requestChain };
    switch (method) {
    case EIP155_SIGNING_METHODS.ETH_SIGN:
    case EIP155_SIGNING_METHODS.PERSONAL_SIGN:
      await ethSignHandler(handlerArgs, method, namespace);
      return;
    case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA:
    case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V3:
    case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V4:
      await ethSignTypedDataHandler(handlerArgs, method, namespace);
      return;
    case EIP155_SIGNING_METHODS.ETH_SIGN_TRANSACTION:
    case EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION:
      await ethSignOrSendTransactionHandler(handlerArgs, method, namespace);
      return;
    default:
      await respond(jsonRpcError(id, getSdkError('UNSUPPORTED_METHODS')));
    }
  } catch (error) {
    console.error('Failed to handle WalletConnect request', error);
    await respond(jsonRpcError(id, APPLICATION_ERROR));
  }
};

type TValidatedHandlerParams = TEthSignHandlerParams & {
  currentSession: SessionTypes.Struct;
  requestChain: TParsedChain;
};

/**
 * WalletConnect's ETH_SIGN gives the params as [address, message]
 * while PERSONAL_SIGN gives them as [message, address].
 */
const ethSignHandler = async (
  args: TValidatedHandlerParams,
  method: string,
  namespace: SessionTypes.Namespace,
) => {
  const { currentSession, id, launchSignDialog, params, requestChain, respond } = args;
  const requestParams = params.request.params;
  if (!Array.isArray(requestParams) || requestParams.length !== 2) {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }

  const isPersonalSign = method === EIP155_SIGNING_METHODS.PERSONAL_SIGN;
  const accountAddress = isPersonalSign ? requestParams[1] : requestParams[0];
  const signingData = isPersonalSign ? requestParams[0] : requestParams[1];
  if (
    typeof accountAddress !== 'string' ||
    !ETH_ADDRESS_REGEX.test(accountAddress) ||
    typeof signingData !== 'string'
  ) {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }
  const decoded = decodeEthMessage(signingData);
  if (decoded === null) {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }
  if (!isApprovedAccount(namespace, requestChain.caip2, accountAddress)) {
    await respond(jsonRpcError(id, getSdkError('UNSUPPORTED_ACCOUNTS')));
    return;
  }

  const accountDetails = await getAccountDetails(accountAddress);
  if (!accountDetails) {
    await respond(jsonRpcError(id, getSdkError('UNSUPPORTED_ACCOUNTS')));
    return;
  }
  const { accountName, accountCode, displayAddress } = accountDetails;
  const apiCaller = () => runSigningApi(
    id,
    respond,
    () => ethSignMessage(accountCode, signingData),
    result => result.signature,
  );

  await launchDialog({
    accountCode,
    apiCaller,
    onReject: () => respond(jsonRpcError(id, getSdkError('USER_REJECTED'))),
    dialogContent: {
      signingData: decoded,
      currentSession,
      accountName,
      accountAddress,
      displayAddress,
      chain: requestChain.caip2,
      method: t('walletConnect.signingRequest.method.signMessage'),
    },
  }, id, respond, launchSignDialog);
};

const ethSignTypedDataHandler = async (
  args: TValidatedHandlerParams,
  method: string,
  namespace: SessionTypes.Namespace,
) => {
  const { currentSession, id, launchSignDialog, params, requestChain, respond } = args;
  const requestParams = params.request.params;
  if (!Array.isArray(requestParams) || requestParams.length !== 2) {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }
  const accountAddress = requestParams[0];
  const requestedData = requestParams[1];
  if (
    typeof accountAddress !== 'string' ||
    !ETH_ADDRESS_REGEX.test(accountAddress)
  ) {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }

  let typedData: unknown;
  let data: string;
  if (typeof requestedData === 'string') {
    data = requestedData;
    try {
      typedData = JSON.parse(data);
    } catch {
      await respond(jsonRpcError(id, INVALID_PARAMS));
      return;
    }
  } else if (method === EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA && isRecord(requestedData)) {
    typedData = requestedData;
    data = JSON.stringify(requestedData);
  } else {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }
  if (!isRecord(typedData)) {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }
  if (!isApprovedAccount(namespace, requestChain.caip2, accountAddress)) {
    await respond(jsonRpcError(id, getSdkError('UNSUPPORTED_ACCOUNTS')));
    return;
  }

  const accountDetails = await getAccountDetails(accountAddress);
  if (!accountDetails) {
    await respond(jsonRpcError(id, getSdkError('UNSUPPORTED_ACCOUNTS')));
    return;
  }
  const { accountName, accountCode, displayAddress } = accountDetails;
  const chainId = Number(requestChain.id);
  const apiCaller = () => runSigningApi(
    id,
    respond,
    () => ethSignTypedMessage(accountCode, chainId, data),
    result => result.signature,
  );

  await launchDialog({
    accountCode,
    apiCaller,
    onReject: () => respond(jsonRpcError(id, getSdkError('USER_REJECTED'))),
    dialogContent: {
      signingData: JSON.stringify(typedData, null, 2),
      currentSession,
      accountName,
      accountAddress,
      displayAddress,
      chain: requestChain.caip2,
      method: t('walletConnect.signingRequest.method.signTypedData'),
    },
  }, id, respond, launchSignDialog);
};

const ethSignOrSendTransactionHandler = async (
  args: TValidatedHandlerParams,
  method: string,
  namespace: SessionTypes.Namespace,
) => {
  const { currentSession, id, launchSignDialog, params, requestChain, respond } = args;
  const requestParams = params.request.params;
  if (!Array.isArray(requestParams) || requestParams.length !== 1) {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }
  const data = requestParams[0];
  if (!isRecord(data)) {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }

  const tx = data;
  if (
    typeof tx.from !== 'string' ||
    !ETH_ADDRESS_REGEX.test(tx.from)
  ) {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }
  if (tx.to === undefined || tx.to === null) {
    await respond(jsonRpcError(id, TRANSACTION_REJECTED));
    return;
  }
  if (
    typeof tx.to !== 'string'
  ) {
    await respond(jsonRpcError(id, INVALID_PARAMS));
    return;
  }
  if (!isApprovedAccount(namespace, requestChain.caip2, tx.from)) {
    await respond(jsonRpcError(id, getSdkError('UNSUPPORTED_ACCOUNTS')));
    return;
  }

  const accountDetails = await getAccountDetails(tx.from);
  if (!accountDetails) {
    await respond(jsonRpcError(id, getSdkError('UNSUPPORTED_ACCOUNTS')));
    return;
  }
  const { accountName, accountCode, displayAddress } = accountDetails;
  const isSendAndSign = method === EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION;
  const chainId = Number(requestChain.id);
  const apiCaller = () => runSigningApi(
    id,
    respond,
    () => ethSignWalletConnectTx(accountCode, isSendAndSign, chainId, data),
    result => isSendAndSign ? result.txHash : result.rawTx,
  );
  const formattedMethod = isSendAndSign ?
    t('walletConnect.signingRequest.method.sendTransaction') :
    t('walletConnect.signingRequest.method.signTransaction');

  await launchDialog({
    accountCode,
    apiCaller,
    onReject: () => respond(jsonRpcError(id, getSdkError('USER_REJECTED'))),
    dialogContent: {
      signingData: JSON.stringify(data),
      currentSession,
      accountName,
      accountAddress: tx.from,
      displayAddress,
      chain: requestChain.caip2,
      method: formattedMethod,
    },
  }, id, respond, launchSignDialog);
};
