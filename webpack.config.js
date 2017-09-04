module.exports = {
  entry: './gdbgui/static/js/src/gdbgui.js',
  output: {
    filename: './gdbgui/static/js/gdbgui.js'
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
