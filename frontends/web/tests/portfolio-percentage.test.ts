// SPDX-License-Identifier: Apache-2.0

import { expect, type APIRequestContext } from '@playwright/test';
import { ChildProcess } from 'child_process';
import { deleteAccountsFile, deleteConfigFile } from './helpers/fs';
import { test } from './helpers/fixtures';
import { ServeWallet } from './helpers/servewallet';
import { assertFieldsCount } from './helpers/dom';
import { cleanFakeMemoryFiles, completeWalletSetupFlow, startSimulator, stopSimulator } from './helpers/simulator';

let servewallet: ServeWallet | undefined;
let simulatorProc: ChildProcess | undefined;

const getSimulatorPath = (): string => {
  const simulatorPath = process.env.SIMULATOR_PATH;
  if (!simulatorPath) {
    throw new Error('SIMULATOR_PATH environment variable not set');
  }
  return simulatorPath;
};

const getChartData = () => {
  const now = new Date();
  const nowTimestamp = Math.floor(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
  ) / 1000);
  const previousTimestamp = Math.floor(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() - 6,
    now.getUTCDate(),
    now.getUTCHours(),
  ) / 1000);
  const chartData = [
    {
      time: previousTimestamp,
      value: 100,
      formattedValue: '100.00',
    },
    {
      time: nowTimestamp,
      value: 150,
      formattedValue: '150.00',
    },
  ];
  const performance = {
    moneyWeightedReturn: 0.25,
  };

  return {
    chartDataMissing: false,
    chartDataDaily: chartData,
    chartDataHourly: chartData,
    chartFiat: 'USD',
    chartPerformance: {
      week: performance,
      month: performance,
      year: performance,
      all: performance,
    },
    chartTotal: 150,
    formattedChartTotal: '150.00',
    chartIsUpToDate: true,
    lastTimestamp: nowTimestamp,
  };
};

const getPortfolioPercentageType = async (
  request: APIRequestContext,
  host: string,
  servewalletPort: number,
) => {
  const response = await request.get(`http://${host}:${servewalletPort}/api/config`);
  const config = await response.json();
  return config.frontend?.portfolioPercentageType;
};

test('Portfolio percentage can switch between value over time and performance', async ({
  page,
  request,
  host,
  frontendPort,
  servewalletPort,
}, testInfo) => {
  await page.route('**/api/chart-data', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: getChartData(),
      }),
    });
  });

  await test.step('Start servewallet', async () => {
    servewallet = new ServeWallet(page, servewalletPort, frontendPort, host, testInfo.outputDir, { simulator: true });
    await servewallet.start();
  });

  await test.step('Start simulator', async () => {
    simulatorProc = startSimulator(getSimulatorPath(), testInfo.outputDir, true);
  });

  await test.step('Initialize wallet', async () => {
    await completeWalletSetupFlow(page);
  });

  await test.step('Wait for accounts to load', async () => {
    await assertFieldsCount(page, 'data-testid', 'account-name', 3);
  });

  await test.step('Show value over time by default', async () => {
    await page.goto('/#/account-summary');
    await expect(page.getByTestId('portfolio-percentage-toggle')).toContainText(/50[.,]00%/, { timeout: 30000 });
  });

  await test.step('Switch to performance in settings', async () => {
    await page.goto('/#/settings/general');
    const portfolioPercentageDropdown = page.getByTestId('portfolio-percentage-dropdown');
    await expect(portfolioPercentageDropdown).toBeVisible();
    await expect(portfolioPercentageDropdown).toContainText('Value over time');
    await portfolioPercentageDropdown.click();
    await page.getByRole('option', { name: 'Performance' }).click();
    await expect(portfolioPercentageDropdown).toContainText('Performance');
    await expect.poll(
      () => getPortfolioPercentageType(request, host, servewalletPort),
      { timeout: 10000 },
    ).toBe('moneyWeightedReturn');
  });

  await test.step('Show performance on the portfolio chart', async () => {
    await page.goto('/#/account-summary');
    await expect(page.getByTestId('portfolio-percentage-toggle')).toContainText(/25[.,]00%/, { timeout: 30000 });
  });

  await test.step('Switch back to value over time from the chart percentage', async () => {
    const portfolioPercentage = page.getByTestId('portfolio-percentage-toggle');
    await portfolioPercentage.click();
    await expect(portfolioPercentage).toContainText(/50[.,]00%/);
    await expect.poll(
      () => getPortfolioPercentageType(request, host, servewalletPort),
      { timeout: 10000 },
    ).toBe('value');
  });
});

test.beforeEach(() => {
  deleteAccountsFile();
  deleteConfigFile();
  cleanFakeMemoryFiles();
});

test.afterEach(async () => {
  if (simulatorProc) {
    await stopSimulator(simulatorProc);
    simulatorProc = undefined;
  }
  await servewallet?.stop();
  servewallet = undefined;
  deleteConfigFile();
  deleteAccountsFile();
  cleanFakeMemoryFiles();
});
