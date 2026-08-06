// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Flat config, replacing `.eslintrc.json`.
 *
 * Nothing in this repo was being linted: ESLint 9 only reads a flat config, and
 * `@typescript-eslint` was not even installed — the old `.eslintrc.json` named a
 * parser that was absent, so `npm run lint` could never have worked. The rules
 * below are a faithful port of what that file asked for, plus the Angular rules
 * an Angular project should have.
 *
 * The ignore list is `.eslintignore` verbatim (flat config ignores that file).
 * `*.spec.ts` is in it, inherited rather than chosen — see the note there.
 */
module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      // Git worktrees, which a parallel agent or a `git worktree add` puts
      // here. Each is a whole second checkout, so linting them means linting
      // the repo again — once per worktree, against whatever state it is in.
      // `npx eslint .` is what CI runs, so without this the gate turns red for
      // reasons that have nothing to do with the branch under test: it counted
      // 26,742 problems, none of them in this checkout's source.
      '.claude/**',
      // Vite's dependency cache, written by `ng serve`. Prebundled
      // third-party code, not source.
      '.angular/**',
      'e2e/**',
      'test-site/**',
      'playwright-report/**',
      // Playwright's run output, including a bundled HTML report.
      'test-results/**',
      'coverage/**',
      'jest.config.js',
      'karma.conf.js',
      'monitor.js',
      'src/test.ts',
      // Static HTML, not Angular templates: the design mockups and the splash
      // screen. Linting them reports accessibility findings against files that
      // are never compiled or served by the app.
      'design/**',
      'src/splash-screen.html',
      // Inherited from `.eslintignore`. Specs are the largest unlinted surface
      // left; dropping this line is a deliberate follow-up, not a formality.
      '**/*.spec.ts'
    ]
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // Carried over from `.eslintrc.json`, with its reasoning intact: return
      // types are inferred well enough that requiring them is noise.
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-require-imports': 'off',

      // These two are the point of linting this codebase. A stray `console.log`
      // in a content script writes to the page's console on every request, and
      // a `debugger` in a service worker halts the extension.
      'no-console': 'error',
      'no-debugger': 'error',

      // The house rule this project is built on: nothing gets suppressed. An
      // `any` or a `@ts-ignore` is how nearly every bug here stayed hidden.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',

      // Omit-by-rest — `const { enabled, selected, ...rest } = r` — is the
      // idiomatic way to drop keys, and the named siblings are the point of the
      // expression rather than an oversight. Everything else about the rule
      // stays on.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],

      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'ohMy', style: 'camelCase' }
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'oh-my', style: 'kebab-case' }
      ]
    }
  },
  {
    // Plain JS — build and tooling scripts, `webpack.config.js`. Without this
    // block they were parsed but had no rules applied at all, so an unused
    // `eslint-disable` in one of them read as "delete me" when in fact nothing
    // was ever being checked.
    files: ['**/*.js'],
    extends: [eslint.configs.recommended],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly', module: 'writable', process: 'readonly',
        __dirname: 'readonly', console: 'readonly'
      }
    },
    rules: {
      'no-console': 'error'
    }
  },
  {
    // Printing to a terminal is what a build or watch script is *for*, so
    // `no-console` is off here rather than disabled file by file inside them.
    files: ['scripts/**', 'webpack.config.js'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    // Playwright *requires* an object destructuring pattern as a fixture's
    // first argument — it rejects anything else at runtime with "First argument
    // must use the object destructuring pattern". A fixture that needs none of
    // the built-ins therefore has to write `async ({}, use)`, which is exactly
    // what `no-empty-pattern` forbids. The rule is right in general and wrong
    // here, so it is narrowed rather than switched off.
    files: ['tests/**/*.ts'],
    rules: {
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }]
    }
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility
    ],
    rules: {}
  }
);
