/**
 * Makes Monaco's language workers start inside the MV3 extension.
 *
 * Monaco's own default (in `min/vs/editor/editor.main.js`) builds every worker
 * out of a blob:
 *
 *   self.MonacoEnvironment = { getWorker: (_, label) => new Worker(F(url)) }
 *   // F(url) -> URL.createObjectURL(new Blob([`importScripts("${url}")`]))
 *
 * A blob worker has an opaque origin, so its `importScripts()` of a
 * `chrome-extension://` script is refused by Chrome:
 *
 *   Failed to execute 'importScripts' on 'WorkerGlobalScope': The script at
 *   'chrome-extension://<id>/oh-my-mock/assets/monaco-editor/min/vs/assets/
 *   json.worker-<hash>.js' failed to load.
 *   Could not create web worker(s). Falling back to loading web worker code in
 *   main thread, which might cause UI freezes.
 *
 * The worker files are present — this is the worker's origin, not a missing
 * asset. Pointing `getWorker` straight at the packaged file makes the worker
 * same-origin with the extension page, which Chrome allows.
 *
 * The workers are created as *classic* workers, exactly as monaco's own blob
 * did (`importScripts`, no `type: 'module'`): each bundle is self-contained
 * and feature-detects `importScripts` to decide it is running in a worker, so
 * a module worker would take a different path through the same file.
 */

/**
 * Where `angular.json` copies monaco, relative to the app's `<base href>`.
 *
 * `app.module.ts` hands this to `provideMonacoEditor` for the editor itself;
 * the workers below are resolved against the same root, so the two can never
 * drift apart.
 */
export const MONACO_BASE_URL = './assets/monaco-editor/min/vs';

/**
 * Monaco's pre-built worker bundles, as shipped in `min/vs/assets`.
 *
 * The file names carry monaco's build hash and therefore change with every
 * monaco upgrade. That would silently disable validation again — the exact
 * failure mode this file exists to fix — so `monaco-environment.spec.ts`
 * reads the real directory out of `node_modules` and fails the moment this
 * map no longer matches what is on disk.
 */
const WORKER_BUNDLES = {
  editor: 'editor.worker-Be8ye1pW.js',
  json: 'json.worker-DKiEKt88.js',
  css: 'css.worker-HnVq6Ewq.js',
  html: 'html.worker-B51mlPHg.js',
  typescript: 'ts.worker-CMbG-7ft.js'
} as const;

export type OhMyMonacoWorkerBundle = keyof typeof WORKER_BUNDLES;

/** The directory the bundles live in, below {@link MONACO_BASE_URL}. */
export const MONACO_WORKER_DIR = 'assets';

/**
 * Which bundle serves a given `label`.
 *
 * `label` is the language id monaco asks for; anything without a language
 * service of its own (plain text, and the editor's own diff/link worker) is
 * served by `editor.worker`. Mirrors monaco's own mapping in `editor.main.js`.
 */
export function monacoWorkerBundle(label: string): OhMyMonacoWorkerBundle {
  switch (label) {
    case 'json':
      return 'json';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'html':
    case 'handlebars':
    case 'razor':
      return 'html';
    case 'typescript':
    case 'javascript':
      return 'typescript';
    default:
      return 'editor';
  }
}

/** Absolute `chrome-extension://` url of the worker bundle for `label`. */
export function monacoWorkerUrl(
  label: string,
  baseUrl: string = MONACO_BASE_URL
): string {
  const file = WORKER_BUNDLES[monacoWorkerBundle(label)];

  // Resolved against the document, the same way monaco resolves its own asset
  // urls — the popup is served from `<extension>/oh-my-mock/index.html`, so a
  // bare relative path would be wrong for any other page hosting an editor.
  return new URL(`${baseUrl}/${MONACO_WORKER_DIR}/${file}`, document.baseURI)
    .href;
}

/** The part of monaco's `MonacoEnvironment` this app sets. */
export interface OhMyMonacoEnvironment {
  getWorker(workerId: string, label: string): Worker;
}

declare global {
  interface Window {
    MonacoEnvironment?: OhMyMonacoEnvironment;
  }
}

/**
 * Replaces monaco's blob-based worker factory with a same-origin one.
 *
 * Must run *after* monaco has loaded: `editor.main.js` assigns
 * `self.MonacoEnvironment` unconditionally while it evaluates, so anything set
 * beforehand is thrown away. `provideMonacoEditor({ onMonacoLoad })` fires
 * right after the AMD `require(['vs/editor/editor.main'])` callback and before
 * the first editor is created, which is early enough: workers are only spun up
 * once a model needs validating.
 */
export function installMonacoEnvironment(): void {
  window.MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
      const url = monacoWorkerUrl(label);
      const worker = new Worker(url, { name: `monaco-${label}` });

      // Monaco reports "could not create web worker(s)" and quietly moves the
      // language service onto the main thread, so a broken worker otherwise
      // shows up as nothing worse than missing squiggles. Say which file.
      worker.addEventListener('error', (event: ErrorEvent) => {
        // eslint-disable-next-line no-console
        console.error(
          `[oh-my-mock] Monaco '${label}' worker failed to start (${url}). ` +
          'Language validation will fall back to the main thread.',
          event.message
        );
      });

      return worker;
    }
  };
}
