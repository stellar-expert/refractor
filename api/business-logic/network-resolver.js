const {Networks} = require('@stellar/stellar-sdk')
const {networks} = require('../app.config.json')
const {standardError} = require('./std-error')

function normalizeNetworkName(network) {
    switch (network) {
        case 'public':
        case 'PUBLIC':
        case '0':
        case 0:
            return 'public'
        case 'testnet':
        case 'test':
        case 'TESTNET':
        case '1':
        case 1:
            return 'testnet'
        default:
            throw standardError(400, 'Unidentified network: ' + network)
    }
}

for (let network of Object.keys(networks))
    networks[network].passphrase = Networks[network.toUpperCase()]

/**
 *
 * @param {string} network
 * @return {{rpc: String, network: String, passphrase: String}}
 */
function resolveNetwork(network) {
    return networks[normalizeNetworkName(network)]
}

/**
 *
 * @param {string} network
 * @return {number}
 */
function resolveNetworkId(network) {
    switch (normalizeNetworkName(network)) {
        case 'public':
            return 0
        case 'testnet':
            return 1
        default:
            throw standardError(400, 'Unidentified network: ' + network)
    }
}

function resolveNetworkParams(network) {
    return networks[normalizeNetworkName(network)]
}

module.exports = {resolveNetwork, resolveNetworkId, resolveNetworkParams, normalizeNetworkName}