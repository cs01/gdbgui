const path = require('path');
const webpack = require('webpack');

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
  plugins: [
    new webpack.ProvidePlugin({
      vis: 'vis',
      $: 'jquery',
      jQuery: 'jquery',
      Split: 'split.js',
      moment: 'moment',
      GeminiScrollbar: 'react-gemini-scrollbar',
      _: 'lodash',
    })
  ],
  module: {
    rules: [{
      test: require.resolve('jquery'),
      use: [{
        loader: 'expose-loader',
        options: 'jQuery'
      }, {
        loader: 'expose-loader',
        options: '$'
      }]
    }, {
      test: /\.(js)$/,
      use: [
        'babel-loader',
        'eslint-loader',
      ],
      exclude: /node_modules/
    }, {
      test: /\.(ttf|eot|svg|woff2?)(\?[\s\S]+)?$/,
      use: [{
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          outputPath: '../fonts/'
        }
      }]
    }, {
      test: /\.(jsx)$/,
      use: [
        'babel-loader',
        'eslint-loader',
      ],
      exclude: /node_modules/
    }, {
      test: /\.(css)$/,
      use: [
        { loader: "style-loader" },
        { loader: "css-loader" }
      ]
    }, {
      test: /\.(scss)$/,
      use: [
        { loader: 'style-loader' },
        { loader: 'css-loader' },
        {
          loader: 'postcss-loader',
          options: {
            plugins: function () {
              // postcss plugins, can be exported to postcss.config.js
              return [
                require('autoprefixer')
              ];
            }
          }
        }, {
          loader: 'sass-loader'
        }]
    }]
  }
}
