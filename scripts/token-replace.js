const fs = require('fs');
const packageJson = require('../package.json');

const version = determineVersion();
const isBeta = !!version.match(/beta/);

replaceToken('./dist/oh-my-mock.js', 'SHOW_DEBUG', String(isBeta));
replaceToken('./dist/oh-my-mock.js', 'VERSION', version);
replaceToken('./dist/content.js', 'SHOW_DEBUG', String(isBeta));
replaceToken('./dist/background.js', 'VERSION', version);
replaceToken('./dist/content.js', 'VERSION', version);
replaceToken('./dist/oh-my-mock/main.js', 'VERSION', version);
replaceTokenWithFileContent('INJECTED_CODE', './dist/content.js', './dist/oh-my-mock.js');

function replaceToken(file, tokenKey, token) {
  const data = fs.readFileSync(file, {encoding:'utf8', flag:'r'});

  const result = data.replace(new RegExp(`__OH_MY_${tokenKey}__`, 'g'), token);

  fs.writeFileSync(file, result, {
    encoding: "utf8",
    flag: "w+",
    mode: 0o666
  });
}

function replaceTokenWithFileContent(tokenKey, sourceFile, inputFile) {
  const token = `'__OH_MY_${tokenKey}__'`;
  const source = fs.readFileSync(sourceFile, {encoding:'utf8', flag:'r'});
  const input = fs.readFileSync(inputFile, {encoding:'utf8', flag:'r'});
  const parts = source.split(token);

  if (parts.length === 2) {
    const update = parts[0] + input + parts[1]; // source.replace(token, input);

    fs.writeFileSync(sourceFile, update, {
      encoding: "utf8",
      flag: "w+",
      mode: 0o666
    });
  }
}

function determineVersion() {
  return process.argv.reduce((v, arg, i) => {
    if (arg === '--version') {
      v = process.argv[i + 1];
    }
    return v;
  },  '') || packageJson.version;
}

