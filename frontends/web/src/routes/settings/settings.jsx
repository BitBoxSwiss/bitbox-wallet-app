import { Component } from 'preact';

import Reset from './components/reset';
import UpgradeFirmware from './components/upgradefirmware';

export default function Settings() {
      return (
          <div>
            <h1>Options</h1>
            <p><Reset /></p>
            <p><UpgradeFirmware /></p>
          </div>
      );
}
