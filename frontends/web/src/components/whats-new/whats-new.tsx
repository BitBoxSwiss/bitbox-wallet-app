// SPDX-License-Identifier: Apache-2.0

import { CSSProperties, Dispatch, PointerEvent, RefObject, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dismissWhatsNew, getWhatsNew, getWhatsNewImage, TReleaseNote, TReleaseNotes } from '@/api/whats-new';
import { A } from '@/components/anchor/anchor';
import { Dialog, DialogButtons, DialogScrollContent } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { useLoad } from '@/hooks/api';
import { useAutoAdvance } from '@/hooks/auto-advance';
import { useMediaQuery } from '@/hooks/mediaquery';
import { runningInAndroid, runningInIOS } from '@/utils/env';
import { getApplicableHighlights, getLocalizedContent, TPlatform } from './release-notes';
import style from './whats-new.module.css';

const PAGE_DURATION = 8000;

const platform = (): TPlatform => {
  if (runningInAndroid()) {
    return 'android';
  }
  if (runningInIOS()) {
    return 'ios';
  }
  return 'desktop';
};

const ReleaseNoteImage = ({ version, path, alt, onReady }: {
  version: string;
  path: string;
  alt: string;
  onReady: () => void;
}) => {
  const image = useLoad(() => getWhatsNewImage(version, path).catch(error => {
    console.error('Could not load release-note image', error);
    return '';
  }), [version, path]);

  useEffect(() => {
    if (image !== undefined) {
      onReady();
    }
  }, [image, onReady]);

  if (image === '') {
    return null;
  }

  return (
    <div className={style.image}>
      {image && <img src={image} alt={alt} />}
    </div>
  );
};

type TContentProps = {
  notes: TReleaseNotes;
  highlights: readonly TReleaseNote[];
  scrollRef: RefObject<HTMLDivElement>;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  dismissed: boolean;
  dismiss: () => void;
};

const ReleaseNotesContent = ({ notes, highlights, scrollRef, page, setPage, dismissed, dismiss }: TContentProps) => {
  const { t, i18n } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [playing, setPlaying] = useState(true);
  const [holding, setHolding] = useState(false);
  const [readyImage, setReadyImage] = useState<string>();
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const highlight = highlights[page];
  const lastPage = page === highlights.length - 1;
  const onImageReady = useCallback(() => setReadyImage(highlight?.image), [highlight?.image]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll) {
      scroll.scrollTop = 0;
    }
  }, [page, isMobile, scrollRef]);

  const stopped = useAutoAdvance({
    enabled: isMobile && !lastPage && !dismissed,
    page,
    duration: PAGE_DURATION,
    paused: !playing || holding || reducedMotion || (!!highlight?.image && readyImage !== highlight.image),
    onAdvance: () => setPage(current => Math.min(current + 1, highlights.length - 1)),
  });

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isMobile || (event.target as Element).closest('button, a, [role="link"]')) {
      return;
    }
    touchStart.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    setHolding(true);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    setHolding(false);
    if (!start || Date.now() - start.time > 500 ||
      Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8 ||
      window.getSelection()?.toString()) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const direction = event.clientX < bounds.left + bounds.width / 2 ? -1 : 1;
    setPage(current => Math.max(0, Math.min(current + direction, highlights.length - 1)));
  };

  if (!highlight) {
    return null;
  }
  const content = getLocalizedContent(highlight, i18n.languages);

  return (
    <>
      <DialogScrollContent key={page} className={style.page}>
        <div
          aria-live="polite"
          className={style.highlight}
          onFocusCapture={() => setPlaying(false)}
          onPointerDown={handlePointerDown}
          onPointerMove={event => {
            const start = touchStart.current;
            if (start && (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8)) {
              touchStart.current = null;
            }
          }}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            touchStart.current = null;
            setHolding(false);
          }}
          onPointerCancel={() => {
            touchStart.current = null;
            setHolding(false);
          }}>
          {highlight.image && (
            <ReleaseNoteImage version={notes.version} path={highlight.image} alt={content.imageAlt || ''} onReady={onImageReady} />
          )}
          <h4 className={style.title}>{content.title}</h4>
          <p className={style.description}>{content.description}</p>
          {content.link && (
            <p className={style.link}>
              <A className={style.learnMore} href={content.link.href}>{content.link.text}</A>
            </p>
          )}
        </div>
      </DialogScrollContent>
      {isMobile ? (
        <DialogButtons className={style.pagination}>
          <div className={style.segments}>
            {highlights.map((item, index) => (
              <Button
                transparent
                key={index}
                className={style.segment}
                aria-label={`${t('whatsNew.progress', { current: index + 1, total: highlights.length })}: ${getLocalizedContent(item, i18n.languages).title}`}
                aria-current={index === page ? 'step' : undefined}
                onClick={() => setPage(index)}>
                <span
                  className={[style.track, index === page && reducedMotion && style.manual].filter(Boolean).join(' ')}
                  aria-hidden="true">
                  <span
                    key={page}
                    className={[
                      style.fill,
                      (index < page || (index === page && lastPage)) && style.complete,
                      index === page && !lastPage && style.active,
                    ].filter(Boolean).join(' ')}
                    style={{
                      '--page-duration': `${PAGE_DURATION}ms`,
                      animationPlayState: stopped ? 'paused' : 'running',
                    } as CSSProperties} />
                </span>
              </Button>
            ))}
          </div>
          {!lastPage && !reducedMotion && (
            <Button
              transparent
              className={style.playback}
              aria-label={t(playing ? 'whatsNew.pause' : 'whatsNew.play')}
              onClick={() => setPlaying(current => !current)}>
              <span aria-hidden="true" className={playing ? style.pauseIcon : style.playIcon} />
            </Button>
          )}
        </DialogButtons>
      ) : (
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
          {lastPage ? (
            <Button className={style.next} primary onClick={dismiss}>{t('button.done')}</Button>
          ) : (
            <Button className={style.next} primary onClick={() => setPage(page + 1)}>
              {t('button.next')}
            </Button>
          )}
        </DialogButtons>
      )}
    </>
  );
};

export const WhatsNew = () => {
  const { t } = useTranslation();
  const notes = useLoad(() => getWhatsNew().catch(error => {
    console.error('Could not load release notes', error);
    return null;
  }));
  const [dismissed, setDismissed] = useState(false);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  if (!notes || highlights.length === 0) {
    return null;
  }

  return (
    <Dialog className={style.dialog} contentRef={scrollRef} open={!dismissed} onClose={dismiss} title={t('whatsNew.title')} medium>
      <ReleaseNotesContent
        notes={notes}
        highlights={highlights}
        scrollRef={scrollRef}
        page={page}
        setPage={setPage}
        dismissed={dismissed}
        dismiss={dismiss} />
    </Dialog>
  );
};
