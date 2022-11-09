const path = require('path')
const {initWebpackConfig} = require('@stellar-expert/webpack-template')
const pkgInfo = require('./package.json')

module.exports = initWebpackConfig({
    entries: {
        'app': {
            import: './views/app.js',
            htmlTemplate: './template/index.html'
        }
    },
    outputPath: path.join(__dirname, './public/'),
    staticFilesPath:'./static/',
    scss: {
        additionalData: '@import "~@stellar-expert/ui-framework/basic-styles/variables.scss";'
    },
    define: {
        appVersion: pkgInfo.version
    },
    devServer: {
        host: '0.0.0.0',
        https: false,
        port: 9002
    }
})