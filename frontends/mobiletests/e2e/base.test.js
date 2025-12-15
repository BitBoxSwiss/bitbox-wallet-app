// SPDX-License-Identifier: Apache-2.0

import { remote } from 'webdriverio';
import { expect } from 'chai';

// --- Test ---
describe('BitBoxApp Base Test', function () {
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

    // Switch to WebView if present
    const contexts = await driver.getContexts();
    console.log('Available contexts:', contexts);
    const webview = contexts.find((c) => c.startsWith('WEBVIEW_'));
    if (webview) await driver.switchContext(webview);

  });

  after(async () => {
    if (driver) await driver.deleteSession();
  });

  it('App main page loads', async () => {
    const body = await driver.$('body');
    const bodyText = await body.getText();
    expect(bodyText).to.include(
      'Please connect your BitBox and tap the side to continue.'
    );
  });
});
