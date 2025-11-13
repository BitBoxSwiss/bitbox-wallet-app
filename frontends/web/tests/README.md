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
