/* eslint-disable no-console */

import * as chokidar from 'chokidar';
import { exec } from 'child_process';
import packageJson from '../package.json';

/**
 * `semver` ships no type declarations and `@types/semver` is not a dependency
 * of this repo, so the one function this script uses is declared here rather
 * than letting an untyped `require` spread `any` over the whole file. Declared
 * for the literal module id only, so it cannot double as a general escape
 * hatch.
 */
interface SemverModule {
  inc(version: string, release: string, identifier: string): string;
}
declare function require(id: 'semver'): SemverModule;
const semver = require('semver');

const PATH_TO_TASKS = {
  'src/content': 'yarn build:content',
  'src/injected': 'yarn build:injected & yarn build:content',
  'src/background': 'yarn build:background',
  'src/shared': 'yarn run-p build:*',
  'src/sandbox': 'yarn build:sandbox',
  'src/app': 'yarn build:ng && yarn build:sandbox',
}

type WatchedPath = keyof typeof PATH_TO_TASKS;

const WATCHED_PATHS = Object.keys(PATH_TO_TASKS) as WatchedPath[];

let version: string = packageJson.version;
let timeoutId: NodeJS.Timeout | undefined;
let promise: Promise<void> | undefined;
const commands = new Set<WatchedPath>()
// One-liner for current directory

chokidar
  .watch(WATCHED_PATHS)
  .on("all", (_event, path) => {
    const command = path2command(path);

    // Nothing to schedule for a path outside `PATH_TO_TASKS`. The old code fed
    // `path2command`'s empty-string fallback straight into the command set,
    // which then built an `undefined` task.
    if (command) {
      commands.add(command);
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (promise) {
      return;
    }

    timeoutId = setTimeout(() => {
      timeoutId = undefined;

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
      promise = undefined;

      if (!timeoutId && commands.size > 0) {
        scheduleBuild();
      }
    });

  return promise;
}

function build(cmds: WatchedPath[]): Promise<void> {
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

function path2command(path: string): WatchedPath | undefined {
  return WATCHED_PATHS.reduce<WatchedPath | undefined>(
    (out, p) => new RegExp(p).test(path) ? p : out, undefined)
}
