const path = require('node:path')
const {readFileSync, writeFileSync} = require('node:fs')
const {initWebpackConfig} = require('@stellar-expert/webpack-template')
const pkgInfo = require('./package.json')

const staticContent = 'static/'

const apiOrigin = process.env.API_ORIGIN || (process.env.WEBPACK_SERVE ? 'http://localhost:3000' : null)
if (!apiOrigin)
    throw new Error('API_ORIGIN environment variable is required to build the UI')

//create a static fonts.css file
const bundledFonts = require.resolve('@stellar-expert/ui-framework/fonts/font.scss')

const css = readFileSync(bundledFonts, 'utf8')
writeFileSync(path.join(__dirname, staticContent, 'fonts.css'), css)
console.log(`${staticContent}fonts.css generated (${css.length} bytes) from ${bundledFonts}`)

module.exports = initWebpackConfig({
    entries: {
        'app': {
            import: './views/app.js',
            htmlTemplate: './template/app.html'
        }
    },
    outputPath: path.join(__dirname, './public/'),
    staticFilesPath: 'static/',
    scss: {
        additionalData: '@import "~@stellar-expert/ui-framework/basic-styles/variables.scss";',
        sassOptions: {
            quietDeps: true,
            silenceDeprecations: ['import']
        }
    },
    define: {
        appVersion: pkgInfo.version,
        apiOrigin
    },
    devServer: {
        host: '0.0.0.0',
        server: {
            type: 'https'
        },
        client: {
            overlay: {
                errors: true,
                runtimeErrors: true,
                warnings: false,
            },
        },
        //serve the static home at `/`, the React shell for deep app links, and map the clean `/api-docs` URL to its file
        historyApiFallback: {
            disableDotRule: true,
            index: '/app.html',
            rewrites: [
                {from: /^\/api-docs\/?$/, to: '/api-docs.html'}
            ]
        },
        port: 9002
    }
})