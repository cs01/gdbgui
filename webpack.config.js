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
    rules: [
      { test: /\.js$/,
        use: [
        'babel-loader',
        'eslint-loader',
        ],
        exclude: /node_modules/
      },
      { test: /\.jsx$/,
        use: [
          'babel-loader',
          'eslint-loader',
        ],
        exclude: /node_modules/
      }
    ]
  }
}
