/**
 * Copyright 2018 Shift Devices AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import envVars from 'preact-cli-plugin-env-vars';

/**
 * Function that mutates original webpack config.
 * Supports asynchronous changes when promise is returned.
 *
 * @param {object} config - original webpack config.
 * @param {object} env - options passed to CLI.
 * @param {WebpackConfigHelpers} helpers - object with useful helpers when working with config.
 */
export default function (config, env, helpers) {
    envVars(config, env, helpers); // gives access to process.env.PREACT_APP_XYZ env vars.

    if (!env.production) {
        config.devServer.overlay = true;
        config.devServer.hot = false;
    }

    {
        // disable SWPrecacheWebpackPlugin
        const SWPrecacheWebpackPlugin = helpers.getPluginsByName(config, 'SWPrecacheWebpackPlugin')[0];
        if (SWPrecacheWebpackPlugin) {
            config.plugins.splice(SWPrecacheWebpackPlugin.index, 1);
        }
    }

    {
        // disable UglifyJsPlugin
        const UglifyJsPlugin = helpers.getPluginsByName(config, 'UglifyJsPlugin')[0];
        if (UglifyJsPlugin) {
            config.plugins.splice(UglifyJsPlugin.index, 1);
        }
    }
}
