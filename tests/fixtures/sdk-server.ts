/**
 * Starting and stopping the optional NodeJS SDK server for a spec.
 *
 * It is not in `webServer` in `playwright.config.ts` on purpose. The extension
 * dials the SDK only when a spec has opted in with `ohMy.setRemote('server')`
 * (`connectIfEnabled` in `src/background/dispatch-remote.ts`) — but "no SDK is
 * running" is itself a case `sdk.spec.ts` tests, and it can only be tested
 * while nothing is listening on port 8000.
 *
 * Two rules this file exists to enforce:
 *
 *  1. Nothing is left behind. A stray server on 8000 would make later runs mock
 *     things no test asked for, which is exactly the kind of phantom failure
 *     that costs hours. `stop()` kills the process group and waits for it, and
 *     a `process.on('exit')` hook catches a Playwright run that dies outright.
 *
 *  2. Start-up is waited for, not slept through. `start()` polls the SDK's own
 *     `/_sdk/health` route until it answers.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import type { SitePage } from './extension';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Where the SDK server listens — hard-coded in `src/background/dispatch-remote.ts`. */
export const SDK_ORIGIN = 'http://localhost:8000';

/** Everything still running, so a dying test run cannot orphan one. */
const running = new Set<ChildProcess>();

process.on('exit', () => {
  for (const child of running) {
    killGroup(child);
  }
});

function killGroup(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    // Negative pid: the whole process group. `spawn` was given `detached`, so
    // the group is this server's alone — nothing else can be caught by it.
    process.kill(-child.pid, signal);
  } catch {
    // Already gone between the check and the kill; nothing to clean up.
  }
}

async function isListening(): Promise<boolean> {
  try {
    const response = await fetch(`${SDK_ORIGIN}/_sdk/health`, {
      signal: AbortSignal.timeout(1_000)
    });

    return response.ok;
  } catch {
    return false;
  }
}

export class SdkServer {
  private constructor(private readonly child: ChildProcess) {}

  /**
   * Spawns `test-site/server/sdk-server.ts` and resolves once it answers.
   *
   * Run through `ts-node` rather than plain node: the SDK imports TypeScript
   * enums from `src/shared`, and Node's type stripping cannot turn an enum into
   * the runtime object one needs.
   */
  static async start(timeoutMs = 45_000): Promise<SdkServer> {
    if (await isListening()) {
      throw new Error(
        `Something is already listening on ${SDK_ORIGIN}. That is almost ` +
          'certainly a leftover SDK server from an earlier run — this spec ' +
          'refuses to share one, because it must also test the case where no ' +
          'server exists.\n' +
          'Clear it with: pkill -f "test-site/server/sdk-server"'
      );
    }

    const child = spawn(
      path.join(REPO_ROOT, 'node_modules', '.bin', 'ts-node'),
      ['-P', './tsconfig-server.json', './test-site/server/sdk-server.ts'],
      { cwd: REPO_ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    running.add(child);

    let output = '';
    child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));

    let exited = false;
    child.on('exit', () => {
      exited = true;
      running.delete(child);
    });

    const server = new SdkServer(child);
    const deadline = Date.now() + timeoutMs;

    while (!(await isListening())) {
      if (exited) {
        throw new Error(`The SDK server exited during start-up:\n${output}`);
      }

      if (Date.now() > deadline) {
        await server.stop();
        throw new Error(
          `The SDK server did not come up on ${SDK_ORIGIN} within ${timeoutMs}ms:\n${output}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return server;
  }

  /** Stops the server and waits for the process to be gone. */
  async stop(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      running.delete(this.child);
      return;
    }

    const exited = new Promise<void>((resolve) => {
      this.child.once('exit', () => resolve());
    });

    killGroup(this.child);

    // ts-node holds the socket.io server open; if SIGTERM is not enough, do not
    // leave the port occupied for the next run.
    const forced = setTimeout(() => killGroup(this.child, 'SIGKILL'), 5_000);

    await exited;
    clearTimeout(forced);
    running.delete(this.child);
  }
}

/**
 * Waits until the extension's background script has actually connected.
 *
 * Neither end reports the handshake — `isConnectedWithLocalServer()` is a module
 * private inside the service worker, and the SDK keeps its socket.io instance to
 * itself — so this asks the question the only way it can be asked: it makes a
 * request from the page and checks whether the SDK was what answered it.
 * `/sdk-probe` exists for this and nothing else, and sits outside `/api` so the
 * probes that fall through are not counted by the test server.
 */
export async function waitForSdkConnection(
  site: SitePage,
  timeoutMs = 20_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const result = await site.request({ url: '/sdk-probe', responseType: 'text' });

    if (result.body === 'sdk-ready') {
      return;
    }

    if (Date.now() > deadline) {
      throw new Error(
        `The extension never connected to the SDK server on ${SDK_ORIGIN}; ` +
          `the last probe was answered by something else (${JSON.stringify(result.body)}).`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
