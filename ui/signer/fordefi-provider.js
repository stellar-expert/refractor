//Fordefi speaks the same postMessage protocol as Freighter, the handshake works only at the top window level
const requestSource = 'FREIGHTER_EXTERNAL_MSG_REQUEST'
const responseSource = 'FREIGHTER_EXTERNAL_MSG_RESPONSE'
let messageCounter = 0

/**
 * postMessage RPC to the Fordefi extension, correlated by message id
 * @param {string} type
 * @param {object} [params]
 * @return {Promise<object>}
 */
function sendFordefiMessage(type, params) {
    return new Promise((resolve, reject) => {
        const messageId = ++messageCounter
        const handler = event => {
            if (event.source !== window || event.data?.source !== responseSource)
                return
            //Fordefi/Freighter reply with "messagedId" (a typo carried over intentionally)
            if (event.data?.messagedId !== messageId)
                return
            window.removeEventListener('message', handler)
            if (event.data.apiError) {
                reject(event.data.apiError)
            } else {
                resolve(event.data)
            }
        }
        window.addEventListener('message', handler)
        window.postMessage({source: requestSource, messageId, type, ...params}, window.location.origin)
    })
}

export default class FordefiProvider {
    title = 'Fordefi'

    isAvailable() {
        return !!window.FordefiProviders?.StellarProvider
    }

    async signTx({xdr, network}) {
        const {publicKey} = await sendFordefiMessage('REQUEST_ACCESS')
        if (!publicKey)
            throw new Error('Failed to connect Fordefi wallet')
        const {signedTransaction} = await sendFordefiMessage('SUBMIT_TRANSACTION', {
            transactionXdr: xdr,
            networkPassphrase: network,
            accountToSign: publicKey
        })
        if (!signedTransaction)
            throw new Error('Failed to sign transaction with Fordefi')
        return signedTransaction
    }
}
