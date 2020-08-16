const path = require("path");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

module.exports = {
  // entry: "./gdbgui/src/js/gdbgui.jsx",
  entry: {
    main: "./gdbgui/src/js/gdbgui.jsx",
    dashboard: "./gdbgui/src/js/dashboard.tsx"
  },
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "gdbgui/static/js/")
    // filename: "build.js"
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"]
      },
      {
        test: /\.(j|t)sx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              experimentalFileCaching: true,
              experimentalWatchApi: true,
              transpileOnly: true
            }
          },
          {
            loader: "tslint-loader",
            options: {
              fix: true,
              typeCheck: true
            }
          }
        ],
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      tslint: true,
      tslintAutoFix: true
    })
  ],
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".css"]
  }
};
