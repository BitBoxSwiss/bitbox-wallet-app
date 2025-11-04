/**
 *  Copyright 2025 Shift Crypto AG
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
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
