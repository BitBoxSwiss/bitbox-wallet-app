// SPDX-License-Identifier: Apache-2.0

export type TVendorIframeMessageTarget = {
  origin: string;
  source: Window;
};

export const getVendorIframeMessageTarget = (
  event: MessageEvent,
  iframe: HTMLIFrameElement | null,
): TVendorIframeMessageTarget | undefined => {
  const source = iframe?.contentWindow;
  if (!source || event.source !== source) {
    return;
  }
  return {
    origin: event.origin,
    source,
  };
};

export const postMessageToVendorIframe = (
  target: TVendorIframeMessageTarget,
  message: unknown,
) => {
  target.source.postMessage(message, target.origin);
};
