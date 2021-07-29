import * as fs from 'fs';
import packageJson from '../package.json';
import manifestJson from '../manifest.json';

const OUT_DIR = './dist';

const version = process.argv[2] || packageJson.version;

manifestJson.version = version;

if (!fs.existsSync(OUT_DIR)){
    fs.mkdirSync(OUT_DIR);
}

fs.writeFile(`${OUT_DIR}/manifest.json`, JSON.stringify(manifestJson, null, 4), 'utf8', function (err: unknown) {
  // eslint-disable-next-line no-console
  if (err) return console.log(err);
});
