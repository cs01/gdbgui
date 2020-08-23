const path = require("path");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

module.exports = {
  entry: {
    main: "./gdbgui/src/js/gdbgui.tsx",
    dashboard: "./gdbgui/src/js/dashboard.tsx"
  },
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "gdbgui/static/js/")
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
          }
        ],
        exclude: /node_modules/
      }
    ]
  },
  plugins: [new ForkTsCheckerWebpackPlugin({})],
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".css"]
  }
};
