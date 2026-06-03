// SPDX-License-Identifier: Apache-2.0

import { Fragment, ReactNode, useEffect, useRef } from 'react';
import { useSettingsHighlight } from '../use-settings-highlight';
import styles from './settings-content.module.css';

export type TSettingsContentItem = {
  content: ReactNode;
  id: string;
};

export type TSettingsContentSection = {
  id: string;
  items: TSettingsContentItem[];
  title?: ReactNode;
};

type TProps = {
  sections: TSettingsContentSection[];
};

export const SettingsContent = ({
  sections,
}: TProps) => {
  const highlightedItemID = useSettingsHighlight();
  const highlightedItemRef = useRef<HTMLDivElement | null>(null);
  const scrolledItemID = useRef<string>();

  useEffect(() => {
    if (!highlightedItemID) {
      scrolledItemID.current = undefined;
      return;
    }

    if (!highlightedItemRef.current || scrolledItemID.current === highlightedItemID) {
      return;
    }

    const scrollToHighlightedItem = () => {
      highlightedItemRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    };

    // waits for the page layout to settle
    // after navigation before centering the item.
    window.setTimeout(scrollToHighlightedItem, 150);
    scrolledItemID.current = highlightedItemID;
  });

  return (
    sections.map(section => {
      if (section.items.length === 0) {
        return null;
      }

      return (
        <Fragment key={section.id}>
          {section.title ? section.title : null}
          {section.items.map(settingItem => {
            const isHighlighted = settingItem.id === highlightedItemID;

            return (
              <div
                className={isHighlighted ? styles.highlightedItem : undefined}
                key={settingItem.id}
                ref={isHighlighted ? highlightedItemRef : undefined}
              >
                {settingItem.content}
              </div>
            );
          })}
        </Fragment>
      );
    })
  );
};
