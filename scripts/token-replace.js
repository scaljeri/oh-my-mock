const fs = require('fs');
const packageJson = require('../package.json');

replaceToken('./dist/oh-my-mock/main.js', 'VERSION', packageJson.version);

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

