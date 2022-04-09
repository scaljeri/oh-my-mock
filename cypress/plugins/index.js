/// <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

/**
 * @type {Cypress.PluginConfig}
 */

// const extensionLoader = require('cypress-browser-extension-plugin/loader');
// const webpack = require('@cypress/webpack-preprocessor');
const path = require('path');

// function getWepPackWithFileChange(options) {
//   const webPackPreProcessor = webpack(options);
//   return function (file) {
//     file.outputPath = file.outputPath.replace('.ts', '.js');
//     return webPackPreProcessor(file);
//   };
// }
// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config
  // const options = {
  //   webpackOptions: require("../../webpack.config"),
  //   watchOptions: {}
  // };
  // on("file:preprocessor", getWepPackWithFileChange(options));

  on('before:browser:launch', (browser, launchOptions) => {
    launchOptions.extensions.push(path.join(__dirname, '..', '..', 'dist'));

    return launchOptions;
  });
};