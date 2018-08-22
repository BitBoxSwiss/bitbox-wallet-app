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

import preactCliTypeScript from 'preact-cli-plugin-typescript';

/**
 * Function that mutates original webpack config.
 * Supports asynchronous changes when promise is returned.
 *
 * @param {object} config - original webpack config.
 * @param {object} env - options passed to CLI.
 * @param {WebpackConfigHelpers} helpers - object with useful helpers when working with config.
 */
export default function (config, env, helpers) {
    if (!env.production) {
        config.devServer.overlay = true;
        config.devServer.hot = false;
    }

    if (env.production) {
        helpers.getPluginsByName(config, 'UglifyJsPlugin')[0].plugin.options.sourceMap = false;
    }

    // https://github.com/wub/preact-cli-plugin-typescript
    preactCliTypeScript(config);

    // Taken from https://medium.com/@sapegin/css-modules-with-typescript-and-webpack-6b221ebe5f10.
    const loader = {
        loader: 'typings-for-css-modules-loader',
        options: {
            modules: true,
            camelCase: true,
            namedExport: true,
            // Existing options (see https://github.com/Jimdo/typings-for-css-modules-loader#usage):
            sourceMap: false,
            importLoaders: 1,
            localIdentName: '[local]__[hash:base64:5]',
        }
    };

    const rules = helpers.getLoadersByName(config, 'css-loader');
    for (const rule of rules) {
        config.module.loaders[rule.ruleIndex].loader[rule.loaderIndex] = loader;
    }
}
