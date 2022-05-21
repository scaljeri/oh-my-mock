const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig');

const esModules = ['@angular'];

module.exports = {
  preset: 'jest-preset-angular',
  roots: ['<rootDir>/src/'],
  globalSetup: 'jest-preset-angular/global-setup',
  testMatch: ['**/+(*.)+(spec).+(ts)'],
  setupFilesAfterEnv: ['<rootDir>/src/test.ts'],
  collectCoverage: true,
  coverageReporters: ['html'],
  coverageDirectory: 'coverage/app',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
    prefix: '<rootDir>/'
  }),
  transform: {
    '^.+\\.(ts|js|html|svg)$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'js', 'html', 'svg'],
  extensionsToTreatAsEsm: ['.ts'], // ts-jest
  globals: {
    'ts-jest': {
      useESM: true // ts-jest
    }
  },
  transform: {
    '^.+\\.(ts|js|mjs|html|svg)$': 'jest-preset-angular',
  },
  transformIgnorePatterns: [
    `<rootDir>/node_modules/(?!.*\\.mjs$|${esModules.join('|')})`, // jest-preset-angular
  ],
  // moduleNameMapper: {
  //   "@shared(.*)": "<rootDir>/src/shared/$1"
  // }
};
