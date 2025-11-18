# E2E Testing with Playwright

This directory contains tests that are run in Github's CI (and can also be run locally) to ensure that some basic use-cases are covered.

The following is a breakdown of the main components:

[playwright.config.ts](../playwright.config.ts) contains the test configuration: this is the entry point for all tests.
It specifies how the webserver (i.e. the frontend) is built, what [projects](https://playwright.dev/docs/test-projects) are enabled, and some other configuration options. Of these, some interesting ones are:

``` typescript
video: 'retain-on-failure'
screenshot: 'only-on-failure',
trace: 'retain-on-failure',
```

These option specify that video of the execution, screenshot of the last state, and the trace, are only kept when a test fails. 
These can be used to debug failing tests (see [Debugging tests](#debugging-tests)).

``` typescript
    launchOptions: {
      // By default, tests are not run in slow motion.
      // Can be enabled by setting the PLAYWRIGHT_SLOW_MO environment variable to a value > 0.
      // This is useful for running tests locally.
      slowMo: PLAYWRIGHT_SLOW_MO,
    },
```
As explained in the comment, `slowMo` is an option that allows test to run at a slower pace. By default Playwright is very fast and hard to follow. By setting the env var `PLAYWRIGHT_SLOW_MO` to a value `N`, Playwright will wait `N` milliseconds between actions.

``` typescript
headless: true
```

If launching a test locally, and you want to see the browser in real time, you need to either change this value to `false`, or launch the test manually from the terminal with the `--headed` option, for example

`npx playwright test <path-to-test-file> --headed`

## Writing tests
Playwright has a lot of documentation on how to [write tests](https://playwright.dev/docs/writing-tests), so refer to that for syntax/features.

This documents covers specific things to keep in mind to write tests for the BitboxApp, and caveats to be mindful of.

### Helpers
Method that might be helpful in more than one test should reside here; this is a list of the current helpers (if you add more, please add them to this list too):

- [fs.ts](./helpers/fs.ts) contains methods used to interact with the filesystem, such as deleting the config.json or the accounts.json files
- [fixtures.ts](./helpers/fixtures.ts) is used to inject env variables in all tests.
- [dom.ts](./helpers/dom.ts) contains methods to interact with the webpage, such as clicking a specific button, getting specific fields based on attribute key/value.
- [servewallet.ts](./helpers/servewallet.ts) is the most important helper file, as it needs to be imported and used by any test. It provides a `Servewallet` class that gives the ability to start/stop/restart the servewallet. 
- [simulator.ts](./helpers/simulator.ts) is similarly useful, as it provides a way to start a simulator, which is needed for most operations.

### Caveats
There are a few things that should be kept in mind when writing tests, due to the nature of the test environment.

* Leftover processes: Playwright doesn't automatically kill child processes spawned by the test, which means that servewallet and simulator will still be running when the test ends. While it would be possible to reuse them in subsequent tests, it is recommended to simply kill them at the end of the file and launch new ones on each test. You can achieve this by using the hooks `test.afterEach` or `test.afterAll`.
* Leftover accounts.json/config.json: if a test needs a clean state for either one or both these files (e.g. [watch-only-test.ts](./watch-only.test.ts)), it is recommended to delete them before the tests, using either `test.beforeAll` or `test.beforeEach`
* Simulator's fake memory files: the simulator [supports](/README.md#local-development-with-bb02-simulator) setting the env variable `FAKE_MEMORY_FILEPATH` to re-use the same seed across different executions. The path is hardcoded, so different executions will share the same fake memory files. It is thus recommended to delete them by using the method `cleanFakeMemoryFiles` provided by [simulator.ts](./helpers/simulator.ts)


[watch-only-test.ts](./watch-only.test.ts) contains example of both pre and post test hooks for most of this cases.

## Debugging tests

When a test fails, Playwright will output elements useful for debugging; these are either in [test-results](./test-results), if running locally, or uploaded as artifact if running in CI. 

The following four items will be uploaded for each failing tests:

* error-context.md - a yaml representation of the page at the moment of failure
* screenshot.png - a screenshot of the webpage at the moment of failure
* video.webm - a recording of the browser during the test execution
* trace.zip - to be inspected with `playwright trace`

Note: video.webm can be hard to utilize as it maintains the speed of execution of the test; so for test ran on Github CI, it will be really quick.

Much more useful is `trace.zip`, that can be inspected with `npx playwright show-trace trace.zip`; this will open a window that can be used to navigate through all the steps of the test, with a corresponding screenshot of the webpage at each step.

Other options, when running locally, are to use the `--ui` or the `--debug` flags, as explained in the [official documentation](https://playwright.dev/docs/running-tests#debugging-tests).
