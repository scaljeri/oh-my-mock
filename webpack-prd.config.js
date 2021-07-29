const config = require('./webpack.config');

config.mode = 'production';
config.module.rules[0].use[0].options.configFile = 'prd.tsconfig.json';

module.exports = config;
