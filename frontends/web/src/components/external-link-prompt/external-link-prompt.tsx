// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { openExternalLink, subscribeExternalLinkRequests } from '@/api/system';
import { alertUser } from '@/components/alert/Alert';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';

export const ExternalLinkPrompt = () => {
  const { t } = useTranslation();
  const activeURL = useRef<string>();
  const [displayedURL, setDisplayedURL] = useState<string>();

  useEffect(() => subscribeExternalLinkRequests(({ url }) => {
    // Keep the URL displayed in the active prompt stable if multiple links are requested.
    if (activeURL.current !== undefined) {
      return;
    }
    activeURL.current = url;
    setDisplayedURL(url);
  }), []);

  const respond = (confirmed: boolean) => {
    const url = activeURL.current;
    activeURL.current = undefined;
    setDisplayedURL(undefined);

    if (!confirmed || url === undefined) {
      return;
    }
    openExternalLink(url)
      .then(response => {
        if (!response.success) {
          alertUser(response.errorMessage
            ? t('unknownError', { errorMessage: response.errorMessage })
            : t('genericError'));
        }
      })
      .catch(console.error);
  };

  return (
    <Dialog
      small
      open={displayedURL !== undefined}
      title={t('externalLinkPrompt.title')}
      onClose={() => respond(false)}>
      <p>
        {displayedURL === undefined
          ? null
          : t('externalLinkPrompt.message', {
            interpolation: { escapeValue: false },
            url: displayedURL,
          })}
      </p>
      <DialogButtons>
        <Button primary onClick={() => respond(true)}>
          {t('externalLinkPrompt.confirm')}
        </Button>
        <Button secondary onClick={() => respond(false)}>
          {t('dialog.cancel')}
        </Button>
      </DialogButtons>
    </Dialog>
  );
};
