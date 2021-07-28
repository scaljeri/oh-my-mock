import * as fs from 'fs';
import packageJson from '../package.json';
import manifestJson from '../manifest.json';

const version = process.argv[2] || packageJson.version;

manifestJson.version = version;

fs.writeFile('./dist/manifest.json', JSON.stringify(manifestJson, null, 4), 'utf8', function (err: unknown) {
  // eslint-disable-next-line no-console
  if (err) return console.log(err);
});
