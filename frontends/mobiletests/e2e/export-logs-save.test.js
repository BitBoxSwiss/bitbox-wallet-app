// SPDX-License-Identifier: Apache-2.0

import { remote } from 'webdriverio';
import { expect } from 'chai';

const getSaveDialogElement = async (driver) => {
  const selectors = [
    'android=new UiSelector().resourceId("com.android.documentsui:id/action_menu_save")',
    'android=new UiSelector().resourceId("com.android.documentsui:id/save")',
    'android=new UiSelector().textContains("Save")',
  ];
  for (const selector of selectors) {
    try {
      const element = await driver.$(selector);
      await element.waitForDisplayed({ timeout: 20000 });
      return element;
    } catch (err) {
      // Try next selector.
    }
  }
  return null;
};

describe('Export logs uses save dialog', function () {
  this.timeout(180000);

  let driver;
  before(async () => {
    const opts =  {
      path: '/',
      port: 4723,
      capabilities: {
        platformName: 'Android',
        'appium:deviceName': 'Android Emulator',
        'appium:automationName': 'UiAutomator2',
        'appium:app': './apk/app-debug.apk',
      }
    };

    driver = await remote(opts);

    const contexts = await driver.getContexts();
    console.log('Available contexts:', contexts);
    const webview = contexts.find((c) => c.startsWith('WEBVIEW_'));
    if (webview) await driver.switchContext(webview);
  });

  after(async () => {
    if (driver) await driver.deleteSession();
  });

  it('Opens the Android save dialog when exporting logs', async () => {
    await driver.execute(() => {
      window.location.hash = '#/settings/advanced-settings';
    });

    const exportLogsButton = await driver.$('//button[contains(., "Export logs")]');
    await exportLogsButton.waitForDisplayed({ timeout: 60000 });
    await exportLogsButton.click();

    await driver.switchContext('NATIVE_APP');
    const saveDialog = await getSaveDialogElement(driver);
    expect(saveDialog, 'expected Android save dialog to be visible').to.not.equal(null);
  });
});
