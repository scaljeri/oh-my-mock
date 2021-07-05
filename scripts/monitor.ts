/* eslint-disable no-console */

declare let require: any;
// import * as chokidar from 'chokidar';
const chokidar = require('chokidar');
const { exec } = require('child_process');
const semver = require('semver');
const packageJson = require('../package.json');


const PATH_TO_TASKS = {
  'src/content': 'yarn build:content',
  'src/injected': 'yarn build:injected',
  'src/background': 'yarn build:background',
  'src/shared': 'yarn run-p build:*',
  'src/app': 'yarn build:ng'
}
let version = packageJson.version;

let promise;
let timeoutId;
const commands = new Set<string>()
// One-liner for current directory
chokidar
  .watch([
    "./src/content",
    "./src/injected",
    "./src/background.ts",
    "./src/shared",
    "./src/app"
  ])
  .on("all", (event, path) => {
    commands.add(path2command(path));

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;

      if (promise) {
        promise.then(() => {
          promise = build(Array.from(commands))
            .catch(() => { })
            .finally(() => {
              promise = null;
              console.log("- finished delayed build");
            });
        });
      } else {
        promise = build(Array.from(commands))
          .catch(() => { })
          .finally(() => {
            promise = null;
            console.log("-finished build");
          });
      }
      commands.clear();
    }, 500);
  });

function build(cmds: string[]): Promise<void> {
  createVersion();
  console.log('VERSION=' + version);
  if (cmds.some(c => c.match(/src\/shared/))) {
    cmds = ['src/shared'];
  }
  console.log("- start build", cmds);
  return new Promise<void>((resolve, reject) => {
    console.log(`${cmds.map(k => PATH_TO_TASKS[k]).join(' && ')} && yarn replace --version ${version}`);
    exec(`${cmds.map(k => PATH_TO_TASKS[k]).join(' && ')} && yarn replace --version ${version}`, (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        reject();
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        reject();
        return;
      }

      console.log(`stdout: ${stdout}`);
      resolve();
    });
  });
}

function createVersion() {
  version = semver.inc(version, 'prerelease', 'beta')
}

function path2command(path): string {
  return Object.keys(PATH_TO_TASKS).reduce((out, p) => new RegExp(p).test(path) ? p : out, '')
}
