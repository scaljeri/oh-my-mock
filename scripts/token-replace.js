const fs = require('fs');
const packageJson = require('../package.json');

const version = determineVersion();
const isBeta = !!version.match(/beta/);

replaceToken('./dist/oh-my-mock/main.js', 'VERSION', version);
replaceToken('./dist/manifest.json', 'VERSION', version);
replaceToken('./dist/oh-my-mock.js', 'SHOW_DEBUG', String(isBeta));
replaceToken('./dist/content.js', 'SHOW_DEBUG', String(isBeta));

function replaceToken(file, tokenKey, token) {
  fs.readFile(file, 'utf8', function (err,data) {
    if (err) {
      return console.log(err);
    }

    const result = data.replace(new RegExp(`__OH_MY_${tokenKey}__`, 'g'), token);

    fs.writeFile(file, result, 'utf8', function (err) {
       if (err) return console.log(err);
    });
  });
}

function determineVersion() {
  return process.argv.reduce((v, arg, i) => {
    if (arg === '--version') {
      v = process.argv[i + 1];
    }
    return v;
  },  '') || packageJson.version;
}

