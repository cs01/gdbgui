module.exports = {
  entry: './gdbgui/src/js/gdbgui.js',
  output: {
    filename: './gdbgui/static/js/index.js'
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
  },
  devtool: 'source-map'
}
