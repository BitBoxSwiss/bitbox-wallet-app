const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

/**
 * Function that mutates original webpack config.
 * Supports asynchronous changes when promise is returned.
 *
 * @param {object} config - original webpack config.
 * @param {object} env - options passed to CLI.
 * @param {WebpackConfigHelpers} helpers - object with useful helpers when working with config.
 **/
export default function (config, env, helpers) {

    if (!env.production) {
        config.devServer.overlay = true;
        config.devServer.hot = false;
    }

    if (env.production) {
        const { index } = helpers.getPluginsByName(config, 'UglifyJsPlugin')[0];
        config.plugins.splice(index, 1);

        // org config https://github.com/developit/preact-cli/blob/3f670a44f0751a3a242dfbf466d235a4205990b2/src/lib/webpack/webpack-client-config.js#L107
        config.plugins.push(new UglifyJsPlugin({
            parallel: true,
            sourceMap: !env.production,
            uglifyOptions: {
                mangle: true,
                ecma: 7,
                output: {
                    ecma: 7
                },
                compress: {
                    passes: 3,
                    pure_funcs: [
                        'classCallCheck',
                        '_classCallCheck',
                        '_possibleConstructorReturn',
                        'Object.freeze',
                        'invariant',
                        'warning'
                    ]
                }
            }
        }));
    }

}
