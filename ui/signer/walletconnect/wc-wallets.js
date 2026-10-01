/**
 * @typedef {Object} WalletConnectMobileWallet
 * @property {string} name - Wallet name
 * @property {string} [icon] - Icon file name in /img/wallets
 * @property {string} link - Native app link
 */

/**
 * Mobile Stellar wallets with WalletConnect support; deep links are taken from the WalletConnect wallet registry
 * (mobile.native field). Wallets ignore bare "wc:" links on mobile, so the pairing URI has to be passed via
 * wallet-specific deep link
 * @type {WalletConnectMobileWallet[]}
 */
export const wcMobileWallets = [
    {name: 'Freighter', icon: 'freighter', link: 'freighterwallet://wc-redirect'}
    /*{name: 'HOT Wallet', link: 'hotwallet://'}*/
]

/**
 * Build wallet deep link that passes pairing URI to the wallet (same format as Reown AppKit uses)
 * @param {string} link - Wallet native link
 * @param {string} uri - WalletConnect pairing URI
 * @return {string}
 */
export function formatPairingLink(link, uri) {
    return `${withTrailingSlash(link)}wc?uri=${encodeURIComponent(uri)}`
}

function withTrailingSlash(link) {
    return link.endsWith('/') ? link : link + '/'
}
