/* eslint-disable no-console */

declare let require: any;
// import * as chokidar from 'chokidar';
const chokidar = require('chokidar');
const { exec } = require('child_process');
const semver = require('semver');
const packageJson = require('../package.json');

const PATH_TO_TASKS = {
  'src/content': 'yarn build:content',
  'src/injected': 'yarn build:injected & yarn build:content',
  'src/background': 'yarn build:background',
  'src/shared': 'yarn run-p build:*',
  'src/app': 'yarn build:ng'
}

let version = packageJson.version;
let timeoutId;
let promise;
const commands = new Set<string>()
// One-liner for current directory

chokidar
  .watch(Object.keys(PATH_TO_TASKS))
  .on("all", (event, path) => {
    commands.add(path2command(path));

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (promise) {
      return;
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;

      scheduleBuild();
    }, 500);
  });

function scheduleBuild(): Promise<void> {
  const input = Array.from(commands)
  commands.clear();

  promise = build(input)
    .catch(() => { })
    .finally(() => {
      console.log("- finished build", timeoutId, commands.size);
      promise = null;

      if (!timeoutId && commands.size > 0) {
        scheduleBuild();
      }
    });

    return promise;
}

function build(cmds: string[]): Promise<void> {
  createVersion();

  if (cmds.some(c => c.match(/src\/shared/))) {
    cmds = ['src/shared']; // rebuild everything
  }

  console.log("- start build", cmds);
  return new Promise<void>((resolve, reject) => {
    console.log(`(${cmds.map(k => PATH_TO_TASKS[k]).join(' && ')};wait) && yarn replace-tokens --version ${version}`);
    exec(`(${cmds.map(k => PATH_TO_TASKS[k]).join(' & ')}; wait) && yarn replace-tokens --version ${version}`, (error, stdout, stderr) => {
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
  version = semver.inc(version, 'prerelease', 'beta');
  //version = semver.inc(version, 'patch');
}

function path2command(path): string {
  return Object.keys(PATH_TO_TASKS).reduce((out, p) => new RegExp(p).test(path) ? p : out, '')
}
