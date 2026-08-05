import * as fs from 'fs';
import * as path from 'path';

import {
  installMonacoEnvironment,
  MONACO_BASE_URL,
  MONACO_WORKER_DIR,
  monacoWorkerBundle,
  monacoWorkerUrl
} from './monaco-environment';

/**
 * The worker bundles monaco ships, straight off disk.
 *
 * `angular.json` copies this exact directory into the extension, so what is
 * here is what the popup can load at runtime.
 *
 * Located through `require.resolve` rather than a `../../..` walk to
 * `node_modules`: the path walk assumed the spec sits inside the checkout that
 * holds the dependencies, which a git worktree does not — its modules resolve
 * from the main checkout, and the walk found nothing there.
 */
function shippedWorkerFiles(): string[] {
  const dir = path.join(
    path.dirname(require.resolve('monaco-editor/package.json')),
    'min/vs',
    MONACO_WORKER_DIR
  );

  return fs.readdirSync(dir).filter((file) => file.includes('.worker-'));
}

describe('monaco environment', () => {
  const labels = ['json', 'javascript', 'typescript', 'css', 'html', 'plaintext'];

  /**
   * The guard that makes a monaco upgrade fail loudly.
   *
   * The bundle names carry monaco's build hash. When they change and the map
   * in `monaco-environment.ts` does not, every worker 404s and the editors go
   * back to having no validation at all — with nothing but a console warning
   * to show for it.
   */
  it('points every language at a worker bundle that is actually shipped', () => {
    const shipped = shippedWorkerFiles();

    for (const label of labels) {
      const file = monacoWorkerUrl(label).split('/').pop();

      expect(shipped).toContain(file);
    }
  });

  it('covers every worker bundle monaco ships', () => {
    const used = new Set(
      labels.map((label) => monacoWorkerUrl(label).split('/').pop())
    );

    expect([...used].sort()).toEqual(shippedWorkerFiles().sort());
  });

  it('serves each language from the bundle that implements it', () => {
    expect(monacoWorkerBundle('json')).toBe('json');
    expect(monacoWorkerBundle('javascript')).toBe('typescript');
    expect(monacoWorkerBundle('typescript')).toBe('typescript');
    expect(monacoWorkerBundle('scss')).toBe('css');
    expect(monacoWorkerBundle('handlebars')).toBe('html');
    // Anything without a language service of its own falls back to the
    // editor's own worker, exactly as monaco's default does.
    expect(monacoWorkerBundle('plaintext')).toBe('editor');
  });

  it('resolves worker urls against the document, not the current route', () => {
    const url = monacoWorkerUrl('json');

    expect(url.startsWith('http')).toBe(true);
    expect(url).toContain(`${MONACO_BASE_URL.replace('./', '')}/${MONACO_WORKER_DIR}/`);
  });

  it('installs a factory that builds same-origin workers, never blobs', () => {
    const created: { url: string | URL; options?: WorkerOptions }[] = [];

    class FakeWorker {
      addEventListener(): void { /* monaco attaches its own listeners */ }

      constructor(url: string | URL, options?: WorkerOptions) {
        created.push({ url, options });
      }
    }

    const original = window.Worker;
    window.Worker = FakeWorker as unknown as typeof Worker;

    try {
      installMonacoEnvironment();
      window.MonacoEnvironment?.getWorker('workerMain.js', 'json');
    } finally {
      window.Worker = original;
    }

    expect(created.length).toBe(1);
    expect(String(created[0].url)).toContain('json.worker-');
    expect(String(created[0].url).startsWith('blob:')).toBe(false);
    // Classic, not `type: 'module'` — the bundles feature-detect
    // `importScripts` to tell they are running inside a worker.
    expect(created[0].options?.type).toBeUndefined();
  });
});
