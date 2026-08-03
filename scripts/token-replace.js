const fs = require('fs');
const packageJson = require('../package.json');

const version = determineVersion();

/**
 * Whether `debug()` output is compiled in.
 *
 * A beta version turns it on, which is the original convention. `OH_MY_DEBUG=1`
 * turns it on for any build, because the alternative — versioning your local
 * build as a beta to see a log line — is not something anyone will do twice.
 */
const showDebug = /beta/.test(version) || process.env.OH_MY_DEBUG === '1';

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

function angularChunks() {
  const dir = './dist/oh-my-mock';

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => `${dir}/${name}`);
}

// `shared/utils/logging.ts` is compiled into the content, injected and
// background bundles, so the debug switch has to reach all three — it used to be
// substituted in two. The popup does not use that logger (it has
// `app/utils/log.ts`) and carries no such token; passing it here is harmless and
// keeps the list of bundles one thing rather than two.
for (const file of BUNDLES) {
  replaceToken(file, 'SHOW_DEBUG', String(showDebug));
  replaceToken(file, 'VERSION', version);
}
replaceTokenWithFileContent('INJECTED_CODE', './dist/content.js', './dist/early-inject-clean.js');

assertNoTokensLeft();

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

  for (const file of ['./dist/oh-my-mock.js', './dist/content.js', './dist/background.js', ...angularChunks()]) {
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
  // (`yarn build:bundles`), which is enough to run the e2e suite. Skip rather
  // than crash, so a partial build stays usable.
  if (!fs.existsSync(file)) {
    // eslint-disable-next-line no-console
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

/**
 * Splices a built file into another, in place of a token.
 *
 * Throws when the token is missing. It used to substitute only when the token
 * occurred exactly once and do nothing otherwise — no message, exit code 0 — so
 * a second occurrence turned the whole splice off. The build stayed green, the
 * token stayed in the output, and the shim it was meant to carry never reached a
 * single page. A build step that cannot do its job has to say so.
 */
function replaceTokenWithFileContent(tokenKey, sourceFile, inputFile) {
  const token = `'__OH_MY_${tokenKey}__'`;
  const source = fs.readFileSync(sourceFile, {encoding:'utf8', flag:'r'});
  const input = fs.readFileSync(inputFile, {encoding:'utf8', flag:'r'});
  const parts = source.split(token);

  if (parts.length < 2) {
    throw new Error(
      `token-replace: ${token} not found in ${sourceFile} — nothing to splice ${inputFile} into`);
  }

  // Every occurrence, so a second one is a duplicate rather than a switch that
  // quietly turns the substitution off.
  fs.writeFileSync(sourceFile, parts.join(input), {
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

