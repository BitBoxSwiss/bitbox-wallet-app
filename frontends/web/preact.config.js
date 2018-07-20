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
    preactCliTypeScript(config);
}
