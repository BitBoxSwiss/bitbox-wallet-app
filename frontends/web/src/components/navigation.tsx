// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAppState } from '@/contexts/app-state-context';
import { usePrevious } from '@/hooks/previous';

export const AppNavigation = () => {
  const [, navigate] = useLocation();

  const {
    accounts,
    deviceIDs,
    devices,
    hasLightningAccount,
  } = useAppState();

  const prevDevices = usePrevious(devices);
  const firstDevice = deviceIDs[0];
  const productName = firstDevice !== undefined && devices[firstDevice];

  const maybeRoute = useCallback(() => {
    const currentURL = window.location.hash.replace(/^#/, '');
    const isIndex = currentURL === '' || currentURL === '/';
    const inAccounts = currentURL.startsWith('/account/');

    // QT and Android start their apps in '/index.html' and '/android_asset/web/index.html' respectively
    // This re-routes them to '/' so we have a simpler uri structure
    if (isIndex && currentURL !== '/' && (!accounts || accounts.length === 0)) {
      navigate('/');
      return;
    }
    // if no accounts are registered on specified views route to /
    const canNavigateWithLightningAccount = (
      currentURL.startsWith('/account-summary')
      || currentURL === '/accounts/all'
    );
    const requiresRegularAccount = (
      currentURL.startsWith('/account-summary')
      || currentURL.startsWith('/add-account')
      || currentURL.startsWith('/settings/manage-accounts')
      || currentURL.startsWith('/accounts/')
    );
    const shouldRedirectNoRegularAccount = (
      !canNavigateWithLightningAccount
      || !hasLightningAccount
    );
    if (accounts.length === 0 && requiresRegularAccount && shouldRedirectNoRegularAccount) {
      navigate('/');
      return;
    }
    // if no devices are registered on specified views route to /
    if (
      deviceIDs.length === 0
      && (
        currentURL.startsWith('/settings/device-settings/')
        || currentURL.startsWith('/manage-backups/')
      )
    ) {
      navigate('/');
      return;
    }
    // if device is connected or in boothloader mode route to device settings
    if (
      deviceIDs.length === 1
      && firstDevice
      && (
        currentURL === '/settings/no-device-connected'
        || (isIndex && productName === 'bitbox02-bootloader')
      )
    ) {
      navigate(`/settings/device-settings/${firstDevice}`);
      return;
    }
    // if on an account that isn't registered route to /
    if (inAccounts && !accounts.some(account => currentURL.startsWith('/account/' + account.code))) {
      navigate('/');
      return;
    }
    // if on index page and have an account or Lightning, route to /account-summary
    if (isIndex && (accounts.length || hasLightningAccount)) {
      // replace current history entry so that the user cannot go back to "index"
      navigate('/account-summary?with-chart-animation=true', { replace: true });
      return;
    }
    // if on the /market/ view and there are no accounts view route to /
    if (accounts.length === 0 && currentURL.startsWith('/market/')) {
      navigate('/');
      return;
    }
    // if in no-accounts settings and has account go to manage-accounts
    if (accounts.length && currentURL === '/settings/no-accounts') {
      navigate('/settings/manage-accounts');
      return;
    }

  }, [accounts, deviceIDs, firstDevice, hasLightningAccount, navigate, productName]);

  useEffect(() => {
    const oldDeviceIDList = Object.keys(prevDevices || {});
    const newDeviceIDList: string[] = Object.keys(devices);

    // If a device is newly connected, we route to the settings.
    if (
      newDeviceIDList.length > 0
      && newDeviceIDList[0] !== oldDeviceIDList[0]
    ) {
      // We only route to settings if it is a bb01 or a bb02 bootloader.
      // The bitbox02 wizard itself is mounted globally (see BitBox02Wizard) so it can be unlocked
      // anywhere at any time.
      // We don't bother implementing the same for the bitbox01.
      // The bb02 bootloader screen is not full screen, so we don't mount it globally and instead
      // route to it.
      const firstNewDevice = newDeviceIDList[0];
      if (firstNewDevice) {
        const productName = devices[firstNewDevice];
        if (productName === 'bitbox' || productName === 'bitbox02-bootloader') {
          navigate(`settings/device-settings/${firstNewDevice}`);
          return;
        }
      }
    }
    maybeRoute();
  }, [devices, maybeRoute, navigate, prevDevices]);

  return null;
};
