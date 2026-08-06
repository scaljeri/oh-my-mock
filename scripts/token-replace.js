const fs = require('fs');
const packageJson = require('../package.json');

const version = determineVersion();

/**
 * `--partial` is for the watcher (`scripts/monitor.ts`), which rebuilds only
 * the bundle whose source changed and then re-runs this script over the whole
 * of `dist`. In that run the *untouched* bundles were already replaced — their
 * tokens are legitimately gone — so the presence assertions below would fail a
 * build that is perfectly fine. A full build never passes this flag: there,
 * every bundle is fresh and a missing token is a broken build.
 */
const isPartial = process.argv.includes('--partial');

/**
 * Whether `debug()` output is compiled in.
 *
 * A beta version turns it on, which is the original convention. `OH_MY_DEBUG=1`
 * turns it on for any build, because the alternative — versioning your local
 * build as a beta to see a log line — is not something anyone will do twice.
 */
const showDebug = /beta/.test(version) || process.env.OH_MY_DEBUG === '1';

/**
 * The tokens each webpack bundle is known to carry, verified against a fresh
 * unminified build of every bundle.
 *
 * This is the other half of the token guard. `assertNoTokensLeft` only sees a
 * token that *survived*, so it cannot catch the opposite failure: a minifier
 * running before this script inlines `const SHOW_DEBUG = '__OH_MY_SHOW_DEBUG__'`,
 * folds the `=== 'true'` comparison to `false` and deletes every `console.debug`
 * — no token left to complain about, and no way to ever switch debug output on.
 * That is exactly what `ci:build` used to do (minify first, replace after), and
 * it is the same fold that disabled every migration via `DEV_VERSION` in
 * `migrate.ts`. A token that should be in a bundle and is not is therefore a
 * failed build, not a quiet no-op.
 */
const EXPECTED_TOKENS = [
  { file: './dist/content.js', tokens: ['SHOW_DEBUG', 'VERSION'] },
  { file: './dist/oh-my-mock.js', tokens: ['SHOW_DEBUG', 'VERSION'] },
  { file: './dist/background.js', tokens: ['SHOW_DEBUG', 'VERSION'] }
];

/**
 * Every bundle that carries a build-time token.
 *
 * The Angular output is **discovered**, not named. It used to list `main.js`
 * alone, which missed every lazy chunk: a page reached by `loadComponent` — the
 * cookies, remote-mocking and domains pages — kept the literal
 * `__OH_MY_VERSION__`, and `StateUtils.version` in a record written from one of
 * them was that string rather than a version. Silent, of course: the token is a
 * valid string, so nothing threw and the record was stored with it.
 */
const BUNDLES = [
  './dist/oh-my-mock.js',
  './dist/content.js',
  './dist/background.js',
  ...angularChunks()
];

assertExpectedTokensPresent();

// `shared/utils/logging.ts` is compiled into the content, injected and
// background bundles, so the debug switch has to reach all three — it used to be
// substituted in two. The popup does not use that logger (it has
// `app/utils/log.ts`) and carries no such token; passing it here is harmless and
// keeps the list of bundles one thing rather than two.
for (const file of BUNDLES) {
  replaceToken(file, 'SHOW_DEBUG', String(showDebug));
  replaceToken(file, 'VERSION', version);
}
assertNoTokensLeft();

function angularChunks() {
  const dir = './dist/oh-my-mock';

  if (!fs.existsSync(dir)) {
    return [];
  }

  // Recursive, even though today every chunk lands flat in the directory: the
  // layout belongs to the Angular builder, and a builder update that starts
  // emitting `chunks/` must not silently move code out of both the replacement
  // and the assertions.
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((name) => name.endsWith('.js'))
    .map((name) => `${dir}/${name}`);
}

/**
 * Fails the build when a token that belongs in a bundle is already gone
 * *before* replacement — see `EXPECTED_TOKENS` for the failure this catches.
 *
 * A bundle that is absent is skipped: `build:bundles` deliberately builds a
 * subset. A bundle that is present must carry its tokens.
 */
function assertExpectedTokensPresent() {
  if (isPartial) {
    return;
  }

  const missing = [];

  for (const { file, tokens } of EXPECTED_TOKENS) {
    if (!fs.existsSync(file)) {
      continue;
    }

    const data = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' });

    for (const token of tokens) {
      if (!data.includes(`__OH_MY_${token}__`)) {
        missing.push(`${file} (__OH_MY_${token}__)`);
      }
    }
  }

  // The version constants live in class statics spread over many modules, so
  // per-chunk expectations would be guesses about the bundler's chunking. What
  // must hold regardless of chunking: the popup knows its version, so the token
  // exists *somewhere* in the Angular output.
  const chunks = angularChunks();
  if (
    chunks.length > 0 &&
    !chunks.some((file) =>
      fs.readFileSync(file, { encoding: 'utf8', flag: 'r' }).includes('__OH_MY_VERSION__'))
  ) {
    missing.push('./dist/oh-my-mock/* (__OH_MY_VERSION__ in no chunk)');
  }

  if (missing.length) {
    throw new Error(
      'token-replace: expected tokens are missing before replacement — ' +
      'was the bundle minified before this script ran? ' +
      missing.join(', '));
  }
}

/**
 * Fails the build if any shipped script still carries a token.
 *
 * The check exists because the failure it catches is invisible: a token that is
 * never replaced is still a perfectly good string, so the extension loads, the
 * page renders, and the wrong value is simply written to storage. Naming the
 * bundles by hand went wrong exactly once and would have gone wrong again the
 * next time a page was made lazy.
 */
function assertNoTokensLeft() {
  const offenders = [];

  for (const file of BUNDLES) {
    if (!fs.existsSync(file)) {
      continue;
    }

    const match = fs
      .readFileSync(file, { encoding: 'utf8', flag: 'r' })
      .match(/__OH_MY_[A-Z_]+__/);

    if (match) {
      offenders.push(`${file} (${match[0]})`);
    }
  }

  if (offenders.length) {
    throw new Error(
      `token-replace: tokens left unreplaced in ${offenders.join(', ')}`);
  }
}

function replaceToken(file, tokenKey, token) {
  // The Angular bundle is absent when only the webpack bundles were built
  // (`npm run build:bundles`), which is enough to run the e2e suite. Skip
  // rather than crash, so a partial build stays usable.
  if (!fs.existsSync(file)) {
    console.log(`token-replace: skipping missing ${file}`);
    return;
  }

  const data = fs.readFileSync(file, {encoding:'utf8', flag:'r'});

  const result = data.replace(new RegExp(`__OH_MY_${tokenKey}__`, 'g'), token);

  fs.writeFileSync(file, result, {
    encoding: "utf8",
    flag: "w+",
    mode: 0o666
  });
}

function determineVersion() {
  return process.argv.reduce((v, arg, i) => {
    if (arg === '--version') {
      v = process.argv[i + 1];
    }
    return v;
  },  '') || packageJson.version;
}
