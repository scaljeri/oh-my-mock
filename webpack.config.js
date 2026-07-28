const path = require('path');

// `TerserPlugin` used to be required here for the commented-out `minimizer`
// below. Requiring a plugin that nothing references only made the file look
// like it minified when it does not; uncomment the block and add the require
// back together.

module.exports = {
  output: {
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              allowTsInNodeModules: true,
              configFile: path.resolve('./dev.tsconfig.json')
            }
          }
        ],
        exclude: /node_modules/
      }
    ]
  },
  // There were two `resolve` blocks and two `mode` keys. A duplicate key is not
  // a merge — the last one silently wins — so the first `resolve`, which also
  // listed `.webpack.js` and `.web.js`, never applied. These are the values
  // that were actually in force; nothing about the build changes here.
  resolve: {
    extensions: ['.js', '.ts']
  },
  devtool: 'source-map',
  mode: 'development',
  optimization: {
    // usedExports: true,
    // minimize: true,
    // mangleExports: true,
    // moduleIds: 'deterministic',
    // concatenateModules: true,
    // minimizer: [
    //   new TerserPlugin({
    //     terserOptions: {
    //       compress: {
    //         // drop_console: true
    //         pure_funcs: [
    //           'console.log',
    //           'console.info',
    //           'console.debug',
    //           'console.warn'
    //         ]
    //       }
    //     }
    //   })
    // ]

    // usedExports: 'global',
    // chunkIds: 'total-size',
    // mergeDuplicateChunks: true,
    // removeAvailableModules: false,
    // removeEmptyChunks: true,
    // sideEffects: false,
    // innerGraph: true,
    // mangleWasmImports: true,
    // splitChunks: {
    //   chunks: 'all'
    // }
  }
};
