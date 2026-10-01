/**
 * @typedef {Object} WalletConnectFlowStatus
 * @property {'connecting'|'pairing'|'requesting'} stage - Current flow stage
 * @property {string} [uri] - Pairing URI to show as QR code or open as a deep link
 * @property {Object} [wallet] - Connected wallet metadata (name, icons, redirect)
 * @property {string} [account] - Connected Stellar account address
 * @property {number} [requestId] - Pending signing request id
 * @property {string} [sessionTopic] - Session topic
 * @property {{name: string, link: string}|null} [mobileWallet] - Mobile wallet app chosen by the user
 * @property {function} cancel - Aborts the flow
 */

const listeners = new Set()
let current = null

/**
 * Current WalletConnect signing flow status
 * @return {WalletConnectFlowStatus|null}
 */
export function getWcStatus() {
    return current
}

/**
 * Update WalletConnect signing flow status and notify subscribers
 * @param {WalletConnectFlowStatus|null} status
 */
export function setWcStatus(status) {
    current = status
    for (const listener of listeners) {
        listener(status)
    }
}

/**
 * Subscribe to WalletConnect status changes
 * @param {function(WalletConnectFlowStatus|null)} listener
 * @return {function} - Unsubscribe callback
 */
export function subscribeWcStatus(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}
