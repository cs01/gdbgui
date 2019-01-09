const path = require('path');

module.exports = {
  entry: './gdbgui/src/js/gdbgui.jsx',
  devtool: 'source-map',
  performance: {
    hints: false
  },
  output: {
    path: path.resolve(__dirname, 'gdbgui/static/js/'),
    filename: 'build.js'
  },
  module: {
    rules: [{
      test: /\.(js|ts)x?$/,
      use: ['ts-loader', {
        loader: 'tslint-loader',
        options: {
          typeCheck: true
        }
      }],
      exclude: /node_modules/
    }]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  }
}