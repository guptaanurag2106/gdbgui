const path = require("path");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");


module.exports = (env, argv) => ({
  context: __dirname,
  entry: {
    main: "./gdbgui/src/js/gdbgui.tsx",
    dashboard: "./gdbgui/src/js/dashboard.tsx"
  },
  devtool: argv.mode === "development" ? "source-map" : false,
  output: {
    path: path.resolve(__dirname, "gdbgui/static/js/"),
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
                "style-loader",
                {
                  loader: "css-loader",
                    options: {
                    url: false
                  }
                },
                "postcss-loader"
            ]
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
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/,
        type: 'asset/resource',
      },
    ]
  },
  plugins: [new ForkTsCheckerWebpackPlugin()],
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".css"]
  },
  watchOptions: {
    ignored: /node_modules/,
  }
});
