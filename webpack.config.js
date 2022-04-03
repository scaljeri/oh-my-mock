const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'development',
  output: {
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: ['.webpack.js', '.web.js', '.ts', '.js']
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
