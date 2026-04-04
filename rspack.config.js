//@ts-check

'use strict';

const path = require('path');
const dotenv = require('dotenv');
const { rspack } = require('@rspack/core');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const isDevelopment = process.env.NODE_ENV === 'development';

/** @type {import('@rspack/core').Configuration} */
const extensionConfig = {
  name: 'extension',
  target: 'node',
  mode: isDevelopment ? 'development' : 'production',
  entry: './src/backend/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    library: {
      type: 'commonjs'
    }
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
            loader: 'builtin:swc-loader',
            options: {
              jsc: { parser: { syntax: 'typescript' } }
            }
          }
        ]
      }
    ]
  },
  devtool: isDevelopment ? 'eval-source-map' : 'source-map',
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      'process.env.DEV_SERVER_URL': JSON.stringify(process.env.DEV_SERVER_URL || 'http://localhost:3000')
    })
  ]
};

/** @type {import('@rspack/core').Configuration} */
const webviewConfig = {
  name: 'webview',
  target: 'web',
  mode: isDevelopment ? 'development' : 'production',
  entry: './src/webview/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
    cssFilename: 'main.css',
    publicPath: isDevelopment ? (process.env.DEV_SERVER_URL || 'http://localhost:3000/') : './',
    module: true
  },
  experiments: {
    outputModule: true,
    css: true,
    incremental: 'advance',
    cache: {
      type: "persistent",
      buildDependencies: [__filename, path.join(__dirname, './rspack.config.js')]
    }
  },
  lazyCompilation: false,
  cache: isDevelopment ? true : false,
  resolve: {
    extensions: ['.ts', '.js', '.scss', '.less', '.css']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: { parser: { syntax: 'typescript' } }
            }
          }
        ]
      },
      {
        test: /\.less$/i,
        use: ['less-loader'],
        type: 'css/auto'
      },
      {
        test: /\.(s[ac]ss)$/i,
        use: ['sass-loader'],
        type: 'css/auto'
      },
      {
        test: /\.(ttf|woff|woff2|eot|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name].[hash:8][ext]'
        }
      }
    ]
  },
  devtool: isDevelopment ? 'eval-source-map' : 'source-map',
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      'process.env.DEV_SERVER_URL': JSON.stringify(process.env.DEV_SERVER_URL || 'http://localhost:3000')
    }),
    new MonacoWebpackPlugin({
      languages: ['javascript', 'typescript', 'json', 'css', 'html'],
      only: ['editorWorkerService', 'javascript', 'typescript', 'json', 'css', 'html']
    })
  ],
  devServer: {
    host: '0.0.0.0',
    port: 3000,
    hot: true,
    allowedHosts: 'all',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*'
    },
    client: {
      overlay: true,
      webSocketURL: {
        hostname: 'localhost',
        protocol: 'ws',
        port: 3000,
        pathname: '/ws',
      },
      webSocketTransport: 'ws'
    },
    webSocketServer: 'ws'
  }
};

module.exports = [extensionConfig, webviewConfig];
