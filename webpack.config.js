const path = require('path');
module.exports = {
   entry: "./src/background/background.ts",
   mode: "development",
   output: {
       filename: "background.js",
       path: path.resolve(__dirname, 'dist')
   },
   resolve: {
       extensions: [".webpack.js", ".web.js", ".ts", ".js"]
   },
   module: {
       rules: [{ test: /\.ts$/, loader: "ts-loader" }]
   }
}
