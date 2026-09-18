module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/tests'],
    transform: {
        '\\.jsx?$': ['@swc/jest', {
            jsc: {
                parser: {syntax: 'ecmascript', jsx: true},
                transform: {react: {runtime: 'automatic'}}
            },
            module: {type: 'commonjs'}
        }]
    },
    transformIgnorePatterns: ['node_modules[\\\\/]\\.pnpm[\\\\/](?!@stellar-expert)'],
    moduleNameMapper: {
        '\\.(scss|css)$': 'identity-obj-proxy'
    },
    setupFiles: ['<rootDir>/tests/setup-env.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    globals: {
        apiOrigin: 'https://api.refractor.test',
        appVersion: 'test'
    },
    clearMocks: true
}
