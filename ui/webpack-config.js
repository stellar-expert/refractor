const path = require('path'),
    pkgInfo = require('./package.json'),
    webpack = require('webpack'),
    MiniCssExtractPlugin = require('mini-css-extract-plugin'),
    cssnano = require('cssnano')

module.exports = function (env, argv) {
    const mode = argv.mode || 'development'
    process.env.NODE_ENV = mode

    console.log('mode=' + mode)

    const isProduction = mode !== 'development'

    const settings = {
        mode,
        entry: {
            'app': [path.join(__dirname, './views/app.js')]
        },
        output: {
            path: path.join(__dirname, './public/distr/'),
            filename: '[name].js',
            chunkFilename: '[name].js',
            publicPath: '/distr/'
        },
        module: {
            rules: [
                {
                    test: /\.js?$/,
                    loader: 'babel-loader',
                    exclude: /node_modules/
                },
                {
                    test: /\.scss$/,
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader
                        },
                        {
                            loader: 'css-loader',
                            options: {
                                importLoaders: 1,
                                url: false,
                                sourceMap: !isProduction
                            }
                        },
                        {
                            loader: 'postcss-loader',
                            options: {
                                ident: 'postcss',
                                plugins: [
                                    cssnano({
                                        autoprefixer: true,
                                        discardComments: {removeAll: true}
                                    })
                                ],
                                sourceMap: !isProduction
                            }
                        },
                        {
                            loader: 'sass-loader',
                            options: {
                                sourceMap: !isProduction,
                                additionalData: '@import "./views/styles/variables.scss";'
                            }
                        }
                    ]
                }
            ]
        },
        plugins: [
            new webpack.IgnorePlugin(/ed25519/),
            new MiniCssExtractPlugin({
                filename: '[name].css'
            }),
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(mode),
                appVersion: JSON.stringify(pkgInfo.version)
            })
        ],
        resolve: {
            alias: {
                'moment': 'dayjs'
            }
        },
        optimization: {}
    }

    if (!isProduction) {
        settings.devtool = 'source-map'
        settings.devServer = {
            historyApiFallback: {
                disableDotRule: true
            },
            compress: true,
            host: '0.0.0.0',
            port: 9002,
            contentBase: [path.resolve(__dirname, 'public')]
        }
    } else {
        settings.plugins.unshift(new webpack.LoaderOptionsPlugin({
            minimize: true,
            debug: false,
            sourceMap: false
        }))

        const TerserPlugin = require('terser-webpack-plugin')

        settings.optimization.minimizer = [new TerserPlugin({
            parallel: true,
            sourceMap: false,
            terserOptions: {
                toplevel: true
            }
        })]

        const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
        settings.plugins.push(new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: 'bundle-stats.html',
            openAnalyzer: false
        }))
    }
    return settings
}