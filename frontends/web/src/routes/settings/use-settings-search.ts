// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { getDeviceInfo } from '@/api/bitbox02';
import type { TDevices } from '@/api/devices';
import { AppContext } from '@/contexts/AppContext';
import { useLoad } from '@/hooks/api';
import { useKeystores } from '@/hooks/backend';
import {
  SETTINGS_SEARCH_QUERY_PARAM,
  filterSettingsSearchItems,
  getSettingsSearchItems,
} from './settings-search';

type TUseSettingsSearchArgs = {
  devices: TDevices;
  hasAccounts: boolean;
};

export const useSettingsSearch = ({
  devices,
  hasAccounts,
}: TUseSettingsSearchArgs) => {
  const { t } = useTranslation();
  const { isTesting } = useContext(AppContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get(SETTINGS_SEARCH_QUERY_PARAM) || '';
  const keystores = useKeystores();
  const hasSoftwareKeystore = keystores?.some(({ type }) => type === 'software') ?? false;
  const deviceId = Object.keys(devices)[0];
  const device = deviceId ? devices[deviceId] : undefined;
  const bb02DeviceId = device === 'bitbox02' ? deviceId : undefined;
  // bb02DeviceId! (with non-null assertion operator) is safe because this callback is only passed to useLoad for BitBox02 devices
  const loadDeviceInfo = useCallback(() => getDeviceInfo(bb02DeviceId!), [bb02DeviceId]);
  const deviceInfoResult = useLoad(bb02DeviceId ? loadDeviceInfo : null);
  const deviceInfo = deviceInfoResult?.success ? deviceInfoResult.deviceInfo : undefined;
  const searchItems = useMemo(() => getSettingsSearchItems({
    deviceInfo,
    devices,
    hasAccounts,
    hasSoftwareKeystore,
    isTesting,
    t,
  }), [deviceInfo, devices, hasAccounts, hasSoftwareKeystore, isTesting, t]);
  const searchResults = useMemo(
    () => filterSettingsSearchItems(searchItems, searchTerm),
    [searchItems, searchTerm],
  );
  const showSearchResults = !!searchTerm.trim();

  const updateSearchTerm = (value: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    const nextSearchTerm = value.trim();
    const hasCurrentSearchTerm = searchParams.has(SETTINGS_SEARCH_QUERY_PARAM);

    if (nextSearchTerm) {
      nextSearchParams.set(SETTINGS_SEARCH_QUERY_PARAM, value);
    } else {
      nextSearchParams.delete(SETTINGS_SEARCH_QUERY_PARAM);
    }
    setSearchParams(nextSearchParams, {
      replace: !nextSearchTerm || hasCurrentSearchTerm,
    });
  };

  return {
    searchResults,
    searchTerm,
    showSearchResults,
    updateSearchTerm,
  };
};
