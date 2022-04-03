/* eslint-disable no-console */
import express from 'express';
import * as path from "path";
import { createServer, IOhFileContext } from '.';
import * as fs from 'fs';

// const filedir = path.dirname(process.argv[1]).replace(/^\./, '');
const base = process.cwd();

const ohArgs = process.argv.slice(2);
const fileBase = path.join(base, cliArgs(ohArgs, '--basePath', '-b') || '');
const inputFile = cliArgs(ohArgs, '-c');
const htmlPath = cliArgs(ohArgs, '--htmlPath', '--html');
const port = Number(cliArgs(ohArgs, '--port', '-p') || 8000);

if (!inputFile) {
  console.log('usage: node server.js -c <input-json-file> [-b path-to-data] [--html static files]')
  console.log('\nExample input-json-file:\n');
  console.log('   [');
  console.log('     {');
  console.log('       "url": "/users",');
  console.log('       "method": "GET",');
  console.log('       "requestType": "XHR",');
  console.log('       "statusCode": "200",');
  console.log('       "path": "./users.json",');
  console.log('     }, ');
  console.log('     { ... }');
  console.log('   ]');
  // node ./dist/libs/nodejs-sdk/server.js -c ./config.json -b ./test-site/data --html ./test-site/html
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(inputFile) + '') as IOhFileContext[];

const ohMyServer = createServer({
  port: port, listenHandler: () => {
    console.log(`Server up and running (port=${port}`);
  },
  local: { basePath: fileBase }
});
const app = ohMyServer.app;

config.forEach(c => {
  const fp = path.join(fileBase, c.path);

  try {
    if (!fs.existsSync(fp)) {
      console.log('\x1b[33m%s\x1b[0m', `File ${fp} does not exist!!`);
    }
  } catch (err) {
    console.error(err)
  }

  ohMyServer.local.add(c);
});
console.log('\n');


// app.get("/", (req: any, res: any) => {
//   res.sendFile(path.resolve(path.join(__dirname, 'html/index.html')));
// });

app.use(express.json());
app.use(express.urlencoded({ extended: true }))

if (htmlPath) {
  console.log('serving static files from ' + path.join(base, htmlPath));
  app.use(express.static(path.join(base, htmlPath)));
}

function cliArgs(args: string[], keyA: string, keyB: string | null = null): string | null {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === keyA || keyB && args[i] === keyB) {
      return args[i + 1];
    }
  }

  return null;
}
