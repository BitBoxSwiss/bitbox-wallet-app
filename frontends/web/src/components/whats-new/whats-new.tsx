// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dismissWhatsNew, getWhatsNew, getWhatsNewImage } from '@/api/whats-new';
import { A } from '@/components/anchor/anchor';
import { Dialog, DialogButtons, DialogScrollContent } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { useLoad } from '@/hooks/api';
import { runningInAndroid, runningInIOS } from '@/utils/env';
import { getApplicableHighlights, getLocalizedContent, TPlatform } from './release-notes';
import style from './whats-new.module.css';

const platform = (): TPlatform => {
  if (runningInAndroid()) {
    return 'android';
  }
  if (runningInIOS()) {
    return 'ios';
  }
  return 'desktop';
};

const ReleaseNoteImage = ({ version, path, alt }: {
  version: string;
  path: string;
  alt: string;
}) => {
  const image = useLoad(() => getWhatsNewImage(version, path).catch(error => {
    console.error('Could not load release-note image', error);
    return '';
  }), [version, path]);

  if (image === '') {
    return null;
  }

  return (
    <div className={style.image}>
      {image && <img src={image} alt={alt} />}
    </div>
  );
};

export const WhatsNew = () => {
  const { t, i18n } = useTranslation();
  const notes = useLoad(() => getWhatsNew().catch(error => {
    console.error('Could not load release notes', error);
    return null;
  }));
  const [page, setPage] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const highlights = notes ? getApplicableHighlights(notes, platform()) : [];

  const dismiss = () => {
    if (!notes || dismissed) {
      return;
    }
    setDismissed(true);
    dismissWhatsNew(notes.version).then(response => {
      if (!response.success) {
        console.error('Could not dismiss release notes', response.errorMessage);
      }
    }).catch(console.error);
  };

  const highlight = highlights[page];
  if (!notes || !highlight) {
    return null;
  }
  const content = getLocalizedContent(highlight, i18n.languages);

  return (
    <Dialog className={style.dialog} open={!dismissed} onClose={dismiss} title={t('whatsNew.title')} medium>
      <DialogScrollContent key={page}>
        <div aria-live="polite" className={style.highlight}>
          {highlight.image && (
            <ReleaseNoteImage version={notes.version} path={highlight.image} alt={content.imageAlt || ''} />
          )}
          <h4 className={style.title}>{content.title}</h4>
          <p className={style.description}>{content.description}</p>
          {content.link && (
            <p className={style.link}>
              <A href={content.link.href}>{content.link.text}</A>
            </p>
          )}
        </div>
      </DialogScrollContent>
      <DialogButtons className={style.actions}>
        {page > 0 && (
          <Button
            className={style.previous}
            secondary
            onClick={() => setPage(page - 1)}>
            {t('button.previous')}
          </Button>
        )}
        {highlights.length > 1 && (
          <p className={style.progress}>
            {t('whatsNew.progress', { current: page + 1, total: highlights.length })}
          </p>
        )}
        {page === highlights.length - 1 ? (
          <Button className={style.next} primary onClick={dismiss}>{t('button.done')}</Button>
        ) : (
          <Button className={style.next} primary onClick={() => setPage(page + 1)}>
            {t('button.next')}
          </Button>
        )}
      </DialogButtons>
    </Dialog>
  );
};
