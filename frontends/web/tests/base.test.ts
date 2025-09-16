import { test, expect } from '@playwright/test';
import { startServeWallet, waitForServewallet } from './helpers/servewallet';

test('App main page loads', async ({ page }) => {

    await test.step('Start servewallet', async () => {
        startServeWallet();
        await waitForServewallet(page);
    });


    await test.step('Navigate to the app', async () => {
        await page.goto('http://localhost:8080');
        const body = page.locator('body');
        await expect(body).toContainText('Please connect your BitBox and tap the side to continue.');
    });
});
