const axios = require('axios')

let callbackHandler = function (txInfo) {
    const {tx, network, hash, callbackUrl} = txInfo
    return axios.post(callbackUrl, {tx, hash, network})
}

/**
 *
 * @param {TxModel} txInfo
 * @returns {Promise}
 */
async function processCallback(txInfo) {
    if (!txInfo.callbackUrl) throw new Error(`Attempt to execute an empty callback for tx ${txInfo.hash}`)
    for (let i = 4; i <= 12; i++) {
        const {statusCode} = await callbackHandler(txInfo)
        if (statusCode === 200) return
        //repeat
        await new Promise(resolve => setTimeout(resolve, 1 << i)) //exponential backoff waiting strategy
    }
    throw new Error(`Server returned invalid status code after processing the callback`) //no response from the server
}

function setCallbackHandler(handler) {
    callbackHandler = handler
}

module.exports = {processCallback, setCallbackHandler}