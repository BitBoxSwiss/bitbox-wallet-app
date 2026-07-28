// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionTypes } from '@walletconnect/types';
import {
  TEthSignHandlerParams, TJsonRpcResponse, TLaunchSignDialog, TRespondSessionRequest,
  createSessionRequestResponder, handleWcEthSignRequest,
} from './walletconnect-eth-sign-handlers';
import { EIP155_SIGNING_METHODS } from './walletconnect';

const accountApi = vi.hoisted(() => ({
  ethSignMessage: vi.fn(),
  ethSignTypedMessage: vi.fn(),
  ethSignWalletConnectTx: vi.fn(),
  getEthAccountCodeAndNameByAddress: vi.fn(),
}));

vi.mock('@/api/account', () => accountApi);
vi.mock('i18next', () => ({ t: (key: string) => key }));

const ADDRESS = '0x1111111111111111111111111111111111111111';
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222';
const REQUEST_ID = 42;
const ALL_METHODS = Object.values(EIP155_SIGNING_METHODS);

const makeTypedData = (domain: Record<string, unknown> = {}) => ({
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      ...(Object.prototype.hasOwnProperty.call(domain, 'chainId') ?
        [{ name: 'chainId', type: 'uint256' }] : []),
    ],
    Message: [{ name: 'contents', type: 'string' }],
  },
  primaryType: 'Message',
  domain: { name: 'Test', ...domain },
  message: { contents: 'Hello' },
});

type TSessionOptions = { accounts?: string[]; chains?: string[]; methods?: string[] };

const makeSession = ({
  accounts = [`eip155:1:${ADDRESS}`],
  chains = ['eip155:1'],
  methods = ALL_METHODS,
}: TSessionOptions = {}) => ({
  topic: 'topic',
  namespaces: { eip155: { accounts, chains, events: [], methods } },
  peer: { metadata: { description: 'Test dapp', icons: [], name: 'Test dapp', url: 'https://example.com' } },
}) as unknown as SessionTypes.Struct;

type TPrepareOptions = { chain?: unknown; currentSession?: SessionTypes.Struct; launchResult?: boolean };

const prepareRequest = (
  method: string,
  params: unknown,
  options: TPrepareOptions = {},
) => {
  const sent = vi.fn<TRespondSessionRequest>().mockResolvedValue(undefined);
  const launchSignDialog = vi.fn<(request: TLaunchSignDialog) => boolean>()
    .mockReturnValue(options.launchResult ?? true);
  const args: TEthSignHandlerParams = {
    id: REQUEST_ID,
    params: {
      chainId: Object.prototype.hasOwnProperty.call(options, 'chain') ?
        options.chain : 'eip155:1',
      request: { method, params },
    },
    currentSession: Object.prototype.hasOwnProperty.call(options, 'currentSession') ?
      options.currentSession : makeSession(),
    respond: createSessionRequestResponder(sent),
    launchSignDialog,
  };
  return { args, launchSignDialog, sent };
};

const expectError = (sent: ReturnType<typeof vi.fn<TRespondSessionRequest>>, code: number, message: string) => {
  expect(sent).toHaveBeenCalledTimes(1);
  expect(sent).toHaveBeenCalledWith({
    id: REQUEST_ID,
    jsonrpc: '2.0',
    error: { code, message },
  });
};

const expectRejectedBeforeLookup = async (
  method: string,
  params: unknown,
  code: number,
  message: string,
  options?: TPrepareOptions,
) => {
  const { args, launchSignDialog, sent } = prepareRequest(method, params, options);
  await handleWcEthSignRequest(args);
  expectError(sent, code, message);
  expect(accountApi.getEthAccountCodeAndNameByAddress).not.toHaveBeenCalled();
  expect(launchSignDialog).not.toHaveBeenCalled();
};

const getLaunchedRequest = (
  launchSignDialog: ReturnType<typeof vi.fn<(request: TLaunchSignDialog) => boolean>>,
) => {
  expect(launchSignDialog).toHaveBeenCalledTimes(1);
  return launchSignDialog.mock.calls[0]![0];
};

describe('WalletConnect Ethereum request handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    accountApi.getEthAccountCodeAndNameByAddress.mockResolvedValue({
      success: true,
      code: 'eth-account',
      displayAddress: ADDRESS,
      name: 'Ethereum account',
    });
    accountApi.ethSignMessage.mockResolvedValue({ success: true, signature: '0xsigned' });
    accountApi.ethSignTypedMessage.mockResolvedValue({ success: true, signature: '0xtyped' });
    accountApi.ethSignWalletConnectTx.mockResolvedValue({ success: true, rawTx: '0xraw', txHash: '0xhash' });
  });

  afterEach(() => vi.restoreAllMocks());

  it('forwards at most one response', async () => {
    const sent = vi.fn<TRespondSessionRequest>().mockResolvedValue(undefined);
    const respond = createSessionRequestResponder(sent);
    const first: TJsonRpcResponse = { id: 1, jsonrpc: '2.0', result: 'first' };

    await Promise.all([
      respond(first),
      respond({ id: 1, jsonrpc: '2.0', result: 'second' }),
    ]);

    expect(sent).toHaveBeenCalledOnce();
    expect(sent).toHaveBeenCalledWith(first);
  });

  it('swallows a failed delivery without attempting another response', async () => {
    const sent = vi.fn<TRespondSessionRequest>().mockRejectedValue(new Error('Relay unavailable'));
    const respond = createSessionRequestResponder(sent);
    const response: TJsonRpcResponse = { id: 1, jsonrpc: '2.0', result: 'signed' };

    await expect(respond(response)).resolves.toBeUndefined();
    await expect(respond({ id: 1, jsonrpc: '2.0', result: 'fallback' })).resolves.toBeUndefined();

    expect(sent).toHaveBeenCalledOnce();
    expect(sent).toHaveBeenCalledWith(response);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('rejects an unknown method', async () => {
    await expectRejectedBeforeLookup(
      'future_unknownMethod', [], 5101, 'Unsupported methods.',
    );
  });

  it.each([
    ['missing', undefined, -32602, 'Invalid params.'],
    ['null', null, -32602, 'Invalid params.'],
    ['malformed', 'eip155:01', -32602, 'Invalid params.'],
    ['unsupported', 'eip155:56', 5100, 'Unsupported chains.'],
  ] as const)('rejects a %s request chain before lookup', async (_name, chain, code, message) => {
    await expectRejectedBeforeLookup(
      EIP155_SIGNING_METHODS.PERSONAL_SIGN,
      ['0x6869', ADDRESS],
      code,
      message,
      { chain },
    );
  });

  it.each([
    ['chain', { chain: 'eip155:10', currentSession: makeSession() }, 5100, 'Unsupported chains.'],
    ['method', { currentSession: makeSession({ methods: [] }) }, 3001, 'Unauthorized method.'],
    [
      'exact CAIP-10 account',
      { currentSession: makeSession({
        accounts: [`eip155:10:${ADDRESS}`],
        chains: ['eip155:1', 'eip155:10'],
      }) },
      5103,
      'Unsupported accounts.',
    ],
  ] as const)('rejects an unapproved %s', async (_name, options, code, message) => {
    await expectRejectedBeforeLookup(
      EIP155_SIGNING_METHODS.PERSONAL_SIGN,
      ['0x6869', ADDRESS],
      code,
      message,
      options,
    );
  });

  it('derives authorization from CAIP-10 accounts when namespace.chains is absent', async () => {
    const currentSession = makeSession({
      accounts: [`eip155:10:${ADDRESS}`],
      chains: ['eip155:10'],
    });
    delete currentSession.namespaces.eip155?.chains;
    const { args, launchSignDialog, sent } = prepareRequest(
      EIP155_SIGNING_METHODS.PERSONAL_SIGN,
      ['0x6869', ADDRESS],
      { chain: 'eip155:10', currentSession },
    );

    await handleWcEthSignRequest(args);

    expect(sent).not.toHaveBeenCalled();
    expect(launchSignDialog).toHaveBeenCalledOnce();
  });

  it('rejects malformed message data before lookup', async () => {
    await expectRejectedBeforeLookup(
      EIP155_SIGNING_METHODS.PERSONAL_SIGN,
      ['0x1', ADDRESS],
      -32602,
      'Invalid params.',
    );
  });

  it.each([
    [EIP155_SIGNING_METHODS.PERSONAL_SIGN, ['0x6869', ADDRESS]],
    [EIP155_SIGNING_METHODS.ETH_SIGN, [ADDRESS, '0x6869']],
  ] as const)('handles the parameter order for %s', async (method, params) => {
    const currentSession = makeSession({
      accounts: [`eip155:10:${ADDRESS}`],
      chains: ['eip155:10'],
    });
    const { args, launchSignDialog, sent } = prepareRequest(method, params, {
      chain: 'eip155:10',
      currentSession,
    });

    await handleWcEthSignRequest(args);
    await getLaunchedRequest(launchSignDialog).apiCaller();

    expect(accountApi.ethSignMessage).toHaveBeenCalledWith('eth-account', '0x6869');
    expect(sent).toHaveBeenCalledWith({ id: REQUEST_ID, jsonrpc: '2.0', result: '0xsigned' });
  });

  it('maps user rejection', async () => {
    const { args, launchSignDialog, sent } = prepareRequest(
      EIP155_SIGNING_METHODS.PERSONAL_SIGN,
      ['0x6869', ADDRESS],
    );
    await handleWcEthSignRequest(args);

    await getLaunchedRequest(launchSignDialog).onReject();

    expectError(sent, 5000, 'User rejected.');
  });

  it('rejects an approved account that is unavailable in the app', async () => {
    accountApi.getEthAccountCodeAndNameByAddress.mockResolvedValue({ success: false });
    const { args, launchSignDialog, sent } = prepareRequest(
      EIP155_SIGNING_METHODS.PERSONAL_SIGN,
      ['0x6869', ADDRESS],
    );

    await handleWcEthSignRequest(args);

    expectError(sent, 5103, 'Unsupported accounts.');
    expect(launchSignDialog).not.toHaveBeenCalled();
  });

  it.each([
    ['device abort', { success: false, aborted: true }, 5000, 'User rejected.'],
    ['backend error', { success: false, errorMessage: 'Backend failed' }, -32000, 'Request failed.'],
  ] as const)('maps a %s response', async (_name, apiResult, code, message) => {
    accountApi.ethSignMessage.mockResolvedValue(apiResult);
    const { args, launchSignDialog, sent } = prepareRequest(
      EIP155_SIGNING_METHODS.PERSONAL_SIGN,
      ['0x6869', ADDRESS],
    );
    await handleWcEthSignRequest(args);

    const result = await getLaunchedRequest(launchSignDialog).apiCaller();

    expect(result.success).toBe(false);
    expectError(sent, code, message);
  });

  it('responds when another signing dialog is active', async () => {
    const { args, sent } = prepareRequest(
      EIP155_SIGNING_METHODS.PERSONAL_SIGN,
      ['0x6869', ADDRESS],
      { launchResult: false },
    );

    await handleWcEthSignRequest(args);

    expectError(sent, -32000, 'Request failed.');
  });

  it('forwards the request chain and raw typed data without a domain chain ID', async () => {
    const data = JSON.stringify(makeTypedData());
    const currentSession = makeSession({
      accounts: [`eip155:10:${ADDRESS}`],
      chains: ['eip155:10'],
    });
    const { args, launchSignDialog, sent } = prepareRequest(
      EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V4,
      [ADDRESS, data],
      { chain: 'eip155:10', currentSession },
    );

    await handleWcEthSignRequest(args);
    const request = getLaunchedRequest(launchSignDialog);
    await request.apiCaller();

    expect(request.dialogContent.chain).toBe('eip155:10');
    expect(accountApi.ethSignTypedMessage).toHaveBeenCalledWith('eth-account', 10, data);
    expect(sent).toHaveBeenCalledWith({ id: REQUEST_ID, jsonrpc: '2.0', result: '0xtyped' });
  });

  it('forwards a mismatched domain chain and maps the backend rejection', async () => {
    accountApi.ethSignTypedMessage.mockResolvedValue({
      success: false,
      errorMessage: 'Firmware rejected typed data',
    });
    const data = JSON.stringify(makeTypedData({ chainId: 1 }));
    const currentSession = makeSession({
      accounts: [`eip155:10:${ADDRESS}`],
      chains: ['eip155:10'],
    });
    const { args, launchSignDialog, sent } = prepareRequest(
      EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V4,
      [ADDRESS, data],
      { chain: 'eip155:10', currentSession },
    );

    await handleWcEthSignRequest(args);
    const result = await getLaunchedRequest(launchSignDialog).apiCaller();

    expect(accountApi.ethSignTypedMessage).toHaveBeenCalledWith('eth-account', 10, data);
    expect(result).toMatchObject({ success: false, errorMessage: 'Firmware rejected typed data' });
    expectError(sent, -32000, 'Request failed.');
  });

  it.each([
    ['malformed JSON', '{invalid'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"hello"'],
  ] as const)('rejects typed data that is %s', async (_name, data) => {
    await expectRejectedBeforeLookup(
      EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V4,
      [ADDRESS, data],
      -32602,
      'Invalid params.',
    );
  });

  it('serializes an object for unversioned typed-data signing', async () => {
    const data = makeTypedData({ chainId: 1 });
    const { args, launchSignDialog, sent } = prepareRequest(
      EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA,
      [ADDRESS, data],
    );

    await handleWcEthSignRequest(args);
    await getLaunchedRequest(launchSignDialog).apiCaller();

    expect(accountApi.ethSignTypedMessage).toHaveBeenCalledWith(
      'eth-account', 1, JSON.stringify(data),
    );
    expect(sent).toHaveBeenCalledWith({ id: REQUEST_ID, jsonrpc: '2.0', result: '0xtyped' });
  });

  it.each([
    ['an omitted recipient', { from: ADDRESS }],
    ['a null recipient', { from: ADDRESS, to: null }],
  ] as const)('rejects contract creation with %s', async (_name, tx) => {
    await expectRejectedBeforeLookup(
      EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION,
      [tx],
      -32003,
      'Transaction rejected.',
    );
  });

  it.each([
    [EIP155_SIGNING_METHODS.ETH_SIGN_TRANSACTION, false, '0xraw'],
    [EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION, true, '0xhash'],
  ] as const)('returns the expected result for %s', async (method, send, expected) => {
    const tx = { from: ADDRESS, to: OTHER_ADDRESS };
    const { args, launchSignDialog, sent } = prepareRequest(method, [tx]);
    await handleWcEthSignRequest(args);

    await getLaunchedRequest(launchSignDialog).apiCaller();

    expect(accountApi.ethSignWalletConnectTx).toHaveBeenCalledWith(
      'eth-account', send, 1, tx,
    );
    expect(sent).toHaveBeenCalledWith({ id: REQUEST_ID, jsonrpc: '2.0', result: expected });
  });
});
