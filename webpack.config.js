module.exports = {
  entry: './gdbgui/src/js/gdbgui.jsx',
  output: {
    filename: './gdbgui/static/js/build.js'
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
