const path = require('path');

module.exports = {
  mode: "development",
  output: {
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: [".webpack.js", ".web.js", ".ts", ".js"]
  },
  module: {
    rules: [{
      test: /\.ts$/,
      use: [{
        loader: 'ts-loader',
        options: {
          configFile: path.resolve('./dev.tsconfig.json')
        }
      }],
      exclude: /node_modules/,
    }]
  },
  resolve: {
    extensions: ['.js', '.ts']
  },
  devtool: false
}
