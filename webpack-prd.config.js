const config = require('./webpack.config');

config.mode = 'production';
config.module.rules[0].use[0].options.configFile = 'prd.tsconfig.json';

// No minification *inside* webpack, deliberately: build-time tokens
// (`__OH_MY_SHOW_DEBUG__`, `__OH_MY_VERSION__`) are substituted by
// `scripts/token-replace.js` after bundling, and production mode's terser ran
// first — it inlined the const holding the debug token, folded
// `'__OH_MY_SHOW_DEBUG__' === 'true'` to `false` and deleted every
// `console.debug` before the token could ever be replaced. Minification is a
// separate step (`ci:minify` in package.json) that runs after `replace-tokens`,
// where it folds the *substituted* value instead.
config.optimization = { ...config.optimization, minimize: false };

// The base config's `devtool: 'source-map'` is for local work; a production
// build must not emit maps — the shipped zip is `dist` verbatim, and one map
// was even listed in `web_accessible_resources` once.
config.devtool = false;

module.exports = config;
