import * as fs from 'fs';
import packageJson from '../package.json';
import manifestJson from '../manifest.json';

const OUT_DIR = './dist';

const fullVersion = process.argv[2] || packageJson.version;

/**
 * Chrome accepts one to four dot-separated integers in `version`, and nothing
 * else. A pre-release suffix — `3.3.15-beta.1`, which is what a beta build of
 * this extension is versioned as — makes the whole manifest invalid, and
 * Chromium then refuses to load the extension at all.
 *
 * That is not theoretical: it is why the `SHOW_DEBUG` switch, which keys on the
 * version containing "beta", could never be exercised. Building a beta produced
 * an extension that would not load, so nobody ever saw the debug output it was
 * meant to turn on.
 *
 * `version_name` is the field for the human-readable one. Chrome shows it
 * wherever it shows a version, and puts no constraints on it.
 */
const numericVersion = fullVersion.split('-')[0];

const manifest: Record<string, unknown> = {
  ...manifestJson,
  version: numericVersion,
  ...(numericVersion !== fullVersion && { version_name: fullVersion })
};

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR);
}

fs.writeFile(
  `${OUT_DIR}/manifest.json`,
  JSON.stringify(manifest, null, 4),
  'utf8',
  function (err: unknown) {
    if (err) {
      // A build whose manifest never landed produces a `dist` Chromium will
      // refuse, so this has to be loud rather than a return value nobody reads.
      throw err;
    }
  }
);
