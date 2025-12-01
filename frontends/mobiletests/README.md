# Mobile e2e tests

This folder contains the necessary files to setup and run tests against Android (and in the future iOS) devices.

The tests are contained in the [e2e](./e2e) directory and use [Appium](https://github.com/appium/appium) to automate execution of actions on the app.

To run the test manually, one can either run `make mobilee2etest` from the [root repo](../..) or execute [run.sh](./run.sh) directly.
The script will start an Appium server, wait for it to be ready, and then call `npm run tests` which uses the testing framework [Mocha](https://mochajs.org/).

Note that, in order for the test to start, an Android emulator must be running. The script doesn't start one as steps to do so tend to be somewhat platform-dependant. When running in CI, an emulator is automatically started through a Github Action.

## Development
To create a new test, simply add a new file called `<test-name>.test.js` to the `e2e` folder.
