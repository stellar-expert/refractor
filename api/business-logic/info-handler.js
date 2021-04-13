const {version, name} = require('../package.json')

const started = new Date()

module.exports = {
    serviceInfo() {
        return {
            service: name,
            version,
            more: 'https://refractor.stellar.expert/',
            started: started.toISOString()
        }
    }
}