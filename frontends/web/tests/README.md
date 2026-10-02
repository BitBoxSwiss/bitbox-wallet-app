# E2E Testing with Playwright

This directory contains tests that are run in GitHub's CI (and can also be run locally) to ensure that some basic use-cases are covered.

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

### Vendor widget messaging

`vendor-widgets.test.ts` serves the local Bitrefill and BTC Direct HTML wrappers at
their production URLs using Playwright routing. It uses the app message protocol
from before commit `c1780d48f`, with HTTPS, HTTP, and opaque-origin parents. The
opaque parent exercises replies to an origin serialized as `null`; native custom
schemes retain wildcard replies for compatibility. Vendor pages and SDK downloads
are stubbed, so these tests need no backend, simulator, credentials, or vendor network
access. They cover configuration, relayed payments, and forged messages from
popups, unrelated windows, and a navigated inner iframe.

Bitrefill currently sends payments directly to `window.top`, bypassing its wrapper.
`src/routes/market/bitrefill.test.tsx` tests the app component's handling of that
inner-frame sender through transaction proposal and signing, alongside the legacy
wrapper relay. It also checks rejection of wrong origins, unrelated windows, and
replaced inner frames in both development and production configurations.

`vendor-iframe-message.test.ts` loads the actual app reply helper into a browser and
checks delayed replies after cross-origin navigation and iframe replacement.

Run both with `npx playwright test tests/vendor-widgets.test.ts tests/vendor-iframe-message.test.ts`.
The usual Playwright webserver setup still applies. These tests do not replace
checkout/signing smoke tests in the native app shells.

The local HTML files must also be deployed to the corresponding hosted `/widgets/*/v1/`
URLs for released apps to receive the wrapper fixes. Keep the existing
`request-configuration` handshake and payloads when updating those shared URLs.

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

## Host passphrase simulator checks

Use firmware 9.28.0 or newer with the host-passphrase unlock workflow and a seeded simulator
with the optional BIP39 passphrase enabled. Keep its flash in a dedicated temporary directory
using `FAKE_MEMORY_FILEPATH`. The graphical BitBox02 simulator is needed to control consent,
entry and confirmation separately; the headless simulator accepts input immediately.

With `servewallet -simulator` and the web frontend running, check:

- After the device password, the Unlock screen shows "Enter BitBox passphrase" and
  "Enter passphrase in app". Clicking the link hides it and requests consent on the device.
  The app overlays "Enter passphrase", "Confirm on the BitBox to enter the passphrase on the
  host" and a BitBox02 image. The input dialog opens only after consent. Both dialogs are
  centered over the existing unlock screen, without a sidebar offset.
- Rejecting consent, closing the dialog, or rejecting the passphrase confirmation resumes
  device entry and offers the link again. Requests using a previous prompt ID are rejected.
- Completing device entry hides the link before the passphrase confirmation screens.
  Both device entry and app submission show a "Confirm passphrase on BitBox" overlay with
  the BitBox02 image. Check this also when device entry finishes as the app link is clicked.
- Submitting a passphrase preserves spaces. Confirming it on the device unlocks the expected
  wallet. An empty string submits the empty passphrase; closing the dialog cancels instead.
- Inputs longer than 149 bytes or containing characters outside the device keyboard's character
  set are rejected in the app. Check 150 characters, an 8 KiB paste, Unicode, control characters,
  tilde and backtick. The dialog must retain the input and allow correction or cancellation;
  the device must keep waiting for host input. A 149-character valid passphrase is accepted.
- Disconnect while the dialog is open, then reconnect. The dialog disappears and the new
  connection starts a fresh unlock. Restarting the app while the device waits for host input
  also recovers through the session reset.
- Firmware older than 9.28.0, or a device without the optional passphrase enabled, uses the
  existing unlock screen without the link.

The simulator has no attestation certificate. Keep its real attestation failure response
and verify that the warning remains visible while the passphrase link and dialog work.
All endpoints must use the real backend and simulator.
