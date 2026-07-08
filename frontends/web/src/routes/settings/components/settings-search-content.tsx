// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TDevices } from '@/api/devices';
import { SubTitle } from '@/components/title';
import {
  SETTINGS_HIGHLIGHT_QUERY_PARAM,
  SETTINGS_SEARCH_PAGE_ORDER,
  groupSearchResultsByPage,
  type TSettingsSearchItem,
  type TSettingsSearchPage,
} from '../settings-search';
import { SettingsItem } from './settingsItem/settingsItem';
import styles from './settings-search-content.module.css';

type TProps = {
  devices: TDevices;
  searchResults: TSettingsSearchItem[];
};

const getSettingsSearchResultURL = (
  searchResult: TSettingsSearchItem,
  firstDeviceID?: string,
) => {
  const searchParams = new URLSearchParams({
    [SETTINGS_HIGHLIGHT_QUERY_PARAM]: searchResult.id,
  });

  if (searchResult.page === 'device') {
    return firstDeviceID ? `/settings/device-settings/${firstDeviceID}?${searchParams}` : undefined;
  }

  const pageURLs: Record<Exclude<TSettingsSearchPage, 'device'>, string> = {
    about: '/settings/about',
    advanced: '/settings/advanced-settings',
    general: '/settings/general',
  };

  return `${pageURLs[searchResult.page]}?${searchParams}`;
};

export const SettingsSearchContent = ({
  devices,
  searchResults,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const firstDeviceID = Object.keys(devices)[0];

  const pageTitles: Record<TSettingsSearchPage, string> = {
    about: t('settings.about'),
    advanced: t('settings.advancedSettings'),
    device: t('sidebar.device'),
    general: t('settings.general'),
  };

  const searchResultsByPage = groupSearchResultsByPage(searchResults);

  return (
    <div className={styles.container}>
      {searchResults.length === 0 ? (
        <p className={styles.empty}>
          {t('settings.search.noResults')}
        </p>
      ) : (
        SETTINGS_SEARCH_PAGE_ORDER.map(page => {
          const pageSearchResults = searchResultsByPage[page];
          const navigableResults = pageSearchResults
            .map(searchResult => ({
              searchResult,
              url: getSettingsSearchResultURL(searchResult, firstDeviceID),
            }))
            .filter(
              (item): item is { searchResult: TSettingsSearchItem; url: string } => item.url !== undefined,
            );

          if (navigableResults.length === 0) {
            return null;
          }

          return (
            <div className={styles.pageGroup} key={page}>
              <SubTitle className={styles.pageTitle}>{pageTitles[page]}</SubTitle>
              {navigableResults.map(({ searchResult, url }) => {
                return (
                  <SettingsItem
                    key={searchResult.id}
                    onClick={() => navigate(url)}
                    settingName={searchResult.title}
                  />
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
};
