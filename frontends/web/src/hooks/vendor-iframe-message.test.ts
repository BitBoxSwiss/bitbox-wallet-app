// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getVendorIframeMessageTarget,
  postMessageToVendorIframe,
} from './vendor-iframe-message';

const createIframe = () => {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  return iframe;
};

describe('vendor iframe messages', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('accepts messages from the current iframe', () => {
    const iframe = createIframe();
    const event = new MessageEvent('message', {
      origin: 'https://widget.example.com',
      source: iframe.contentWindow,
    });

    expect(getVendorIframeMessageTarget(event, iframe)).toEqual({
      origin: 'https://widget.example.com',
      source: iframe.contentWindow,
    });
  });

  it('rejects messages from a different window', () => {
    const iframe = createIframe();
    const otherIframe = createIframe();
    const event = new MessageEvent('message', {
      origin: 'https://widget.example.com',
      source: otherIframe.contentWindow,
    });

    expect(getVendorIframeMessageTarget(event, iframe)).toBeUndefined();
  });

  it('replies to the validated source with its exact origin', () => {
    const iframe = createIframe();
    const source = iframe.contentWindow;
    if (!source) {
      throw new Error('Expected iframe to have a content window');
    }
    const postMessage = vi.spyOn(source, 'postMessage').mockImplementation(() => {});
    const target = getVendorIframeMessageTarget(new MessageEvent('message', {
      origin: 'https://widget.example.com',
      source,
    }), iframe);
    if (!target) {
      throw new Error('Expected message target');
    }

    postMessageToVendorIframe(target, { type: 'response' });

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'response' },
      'https://widget.example.com',
    );
  });
});
