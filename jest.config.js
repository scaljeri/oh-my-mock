const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig');

const esModules = ['@angular'];

module.exports = {
  preset: 'jest-preset-angular',
  roots: ['<rootDir>/src/'],
  globalSetup: 'jest-preset-angular/global-setup',
  testMatch: ['**/+(*.)+(spec).+(ts)'],
  setupFilesAfterEnv: ['<rootDir>/src/test.ts'],
  // preset: 'jest-preset-angular/presets/defaults-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'jsdom',
  collectCoverage: true,
  coverageReporters: ['html'],
  coverageDirectory: 'coverage/app',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
    prefix: '<rootDir>/'
  }),
  // transform: {
  //   '^.+\\.(ts|js|html|svg)$': 'ts-jest'
  // },
  transform: {
    '^.+\\.(ts|js|mjs|html|svg)$': 'jest-preset-angular'
  },
  moduleFileExtensions: ['ts', 'js', 'html', 'svg'],
  modulePathIgnorePatterns: ['<rootDir>/src/app'],
  globals: {
    'ts-jest': {
      useESM: true // ts-jest
    }
  },

  transformIgnorePatterns: [
    // `<rootDir>/node_modules/(?!.*\\.mjs$|${esModules.join('|')})`, // jest-preset-angular
    "node_modules/(?!@ngrx|(?!deck.gl)|ng-dynamic)"
  ],
  // moduleNameMapper: {
  //   "@shared(.*)": "<rootDir>/src/shared/$1"
  // },
  moduleFileExtensions: ['ts', 'js', 'html', 'svg']
  // moduleDirectories: ['node_modules', 'src']
  // extensionsToTreatAsEsm: ['.ts'],
  // globals: {
  //   'ts-jest': {
  //     tsconfig: '<rootDir>/tsconfig.spec.json',
  //     stringifyContentPathRegex: '\\.html$',
  //     useESM: true,
  //   },
  // }
};
