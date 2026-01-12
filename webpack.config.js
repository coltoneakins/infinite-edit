//@ts-check

'use strict';

const webpack = require('webpack');
const path = require('path');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { execSync } = require('child_process');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const isDevelopment = process.env.NODE_ENV === 'development';

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node',
  mode: isDevelopment ? 'development' : 'production',
  entry: './src/backend/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs'
  },
  externals: {
    vscode: 'commonjs vscode',
    '@hediet/node-reload': 'commonjs @hediet/node-reload',
    '@hediet/node-reload/node': 'commonjs @hediet/node-reload/node'
  },

  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          }
        ]
      }
    ]
  },
  devtool: isDevelopment ? 'eval-source-map' : 'source-map',
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    })
  ]
};


const webviewConfig = {
  target: 'web',
  mode: isDevelopment ? 'development' : 'production',
  entry: './src/webview/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
    publicPath: isDevelopment ? 'http://localhost:3000/' : undefined,
    libraryTarget: 'module'
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    extensions: ['.ts', '.js', '.scss', '.less', '.css'],
    alias: {
      'atom://seti-ui': path.resolve(__dirname, 'assets/seti-ui')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          }
        ]
      },
      {
        test: /\.less$/i,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'less-loader',
        ],
      },
      {
        test: /\.(s[ac]ss|css)$/i,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader',
        ],
      },
      {
        test: /\.(ttf|woff|woff2|eot|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name].[hash:8][ext]'
        }
      },
    ]
  },
  devtool: isDevelopment ? 'eval-source-map' : 'source-map',
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    }),
    new MiniCssExtractPlugin({
      filename: 'main.css',
    }),
    new MonacoWebpackPlugin({
      languages: ['javascript', 'typescript', 'json', 'css', 'html']
    })
  ],
  devServer: {
    port: 3000,
    hot: true,
    allowedHosts: 'all',
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    client: {
      overlay: true,
    }
  }
};

module.exports = [extensionConfig, webviewConfig];