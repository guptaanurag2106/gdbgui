const path = require("path");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");


module.exports = (env, argv) => {
  const is_dev = argv.mode === "development";

  return {
    context: __dirname,
    entry: {
      main: "./gdbgui/src/js/gdbgui.tsx",
      dashboard: "./gdbgui/src/js/dashboard.tsx"
    },
    devtool: is_dev ? "source-map" : false,
    output: {
      path: path.resolve(__dirname, "gdbgui/static/js/"),
    },
    cache: {
      type: "filesystem",
      buildDependencies: {
        config: [__filename]
      }
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
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        async: is_dev
      })
    ],
    resolve: {
      extensions: [".js", ".ts", ".tsx", ".css"]
    },
    watchOptions: {
      ignored: /node_modules/,
    }
  }
};
