import {bytesToHex, deriveSymKey, generateX25519, randomBytes, topicOf} from './wc-crypto'
import {RelayClient, nextId} from './wc-relay'

const defaultRelayUrl = 'wss://relay.walletconnect.org'
const proposalTtl = 300
const settleTimeout = 60_000
const requestTtl = 300
const cleanupTimeout = 3000
const disconnectReason = {code: 6000, message: 'User disconnected.'}

//[request tag, ttl] for each Sign/Pairing protocol method; the response tag is always request tag + 1
const rpcOpts = {
    wc_pairingDelete: [1000, 86400],
    wc_pairingPing: [1002, 30],
    wc_sessionPropose: [1100, proposalTtl],
    wc_sessionSettle: [1102, 300],
    wc_sessionUpdate: [1104, 86400],
    wc_sessionExtend: [1106, 86400],
    wc_sessionRequest: [1108, requestTtl],
    wc_sessionEvent: [1110, 300],
    wc_sessionDelete: [1112, 86400],
    wc_sessionPing: [1114, 30]
}

/**
 * @typedef {Object} WalletConnectStatus
 * @property {'connecting'|'pairing'|'requesting'} stage - Current flow stage
 * @property {string} [uri] - Pairing URI to show as QR code or open as a deep link
 * @property {Object} [wallet] - Connected wallet metadata (name, icons, redirect)
 * @property {string} [account] - Connected Stellar account address
 * @property {number} [requestId] - Pending signing request id
 * @property {string} [sessionTopic] - Session topic
 */

/**
 * Pair with a wallet over WalletConnect, request a transaction signature, and drop the session afterwards
 * @param {string} xdr - Transaction envelope XDR
 * @param {string} chainId - CAIP-2 chain id ("stellar:pubnet" or "stellar:testnet")
 * @param {string} projectId - Reown project id
 * @param {string} [relayUrl] - Relay endpoint
 * @param {Object} metadata - dApp metadata shown by the wallet
 * @param {function(WalletConnectStatus|null)} onStatus - Flow stage change callback
 * @param {AbortSignal} [signal] - Aborts the flow
 * @return {Promise<string>} - Signed transaction envelope XDR
 */
export async function signXdr({xdr, chainId, projectId, relayUrl = defaultRelayUrl, metadata, onStatus, signal}) {
    const flow = new SignFlow({projectId, relayUrl, signal})
    try {
        return await flow.run({xdr, chainId, metadata, onStatus})
    } finally {
        onStatus(null)
        await flow.dispose()
    }
}

class SignFlow {
    constructor({projectId, relayUrl, signal}) {
        this.relay = new RelayClient({
            relayUrl,
            projectId,
            ua: `wc-2/refractor-${appVersion}/browser`,
            onMessage: (topic, payload) => this.processMessage(topic, payload),
            onError: e => this.fail(e)
        })
        this.waiters = new Set()
        this.failure = new Promise((_, reject) => this.rejectFlow = reject)
        this.failure.catch(() => {})
        this.signal = signal
        this.onAbort = () => this.fail(new Error('Cancelled'))
        signal?.addEventListener('abort', this.onAbort)
        if (signal?.aborted) {
            this.onAbort()
        }
    }

    async run({xdr, chainId, metadata, onStatus}) {
        onStatus({stage: 'connecting'})
        await this.guard(this.relay.open())
        //pairing
        const pairingKey = randomBytes(32)
        const pairingTopic = topicOf(pairingKey)
        await this.guard(this.relay.subscribe(pairingTopic, pairingKey))
        //session proposal
        const keyPair = generateX25519()
        const expiryTimestamp = Math.floor(Date.now() / 1000) + proposalTtl
        const proposalId = nextId()
        const namespaces = {stellar: {chains: [chainId], methods: ['stellar_signXDR'], events: []}}
        const proposalResponse = this.waitForResponse(pairingTopic, proposalId, proposalTtl, 'WalletConnect pairing request expired')
        await this.guard(this.sendRequest(pairingTopic, proposalId, 'wc_sessionPropose', {
            //legacy wallets only read required namespaces, current SDK treats all namespaces as optional
            requiredNamespaces: namespaces,
            optionalNamespaces: namespaces,
            relays: [{protocol: 'irn'}],
            proposer: {publicKey: bytesToHex(keyPair.pub), metadata},
            expiryTimestamp,
            pairingTopic,
            id: proposalId
        }))
        onStatus({
            stage: 'pairing',
            uri: `wc:${pairingTopic}@2?relay-protocol=irn&symKey=${bytesToHex(pairingKey)}&expiryTimestamp=${expiryTimestamp}`
        })
        const approval = await proposalResponse
        this.pairingTopic = pairingTopic
        if (approval.error)
            throw new Error('Wallet rejected the connection' + formatRpcError(approval.error))
        //session settlement
        const sessionKey = deriveSymKey(keyPair.priv, approval.result.responderPublicKey)
        const sessionTopic = topicOf(sessionKey)
        const settlement = this.waitFor((topic, payload) => topic === sessionTopic && payload.method === 'wc_sessionSettle',
            settleTimeout, 'Wallet did not confirm the session')
        await this.guard(this.relay.subscribe(sessionTopic, sessionKey))
        const settle = await settlement
        this.sessionTopic = sessionTopic
        await this.guard(this.sendResult(sessionTopic, settle, true))
        const account = findAccount(settle.params.namespaces, chainId)
        if (!account)
            throw new Error(`Wallet does not support Stellar ${chainId.split(':')[1]} network`)
        //signing request
        const requestId = nextId()
        //request id and session topic are needed to build the wallet deep link on mobile devices
        onStatus({stage: 'requesting', wallet: settle.params.controller?.metadata, account, requestId, sessionTopic})
        const signResponse = this.waitForResponse(sessionTopic, requestId, requestTtl, 'Signing request expired')
        await this.guard(this.sendRequest(sessionTopic, requestId, 'wc_sessionRequest', {
            request: {method: 'stellar_signXDR', params: {xdr}},
            chainId
        }))
        const res = await signResponse
        if (res.error)
            throw new Error(res.error.message || 'Wallet rejected the request')
        const signed = typeof res.result === 'string' ? res.result : res.result?.signedXDR
        if (!signed)
            throw new Error('Wallet returned no signed transaction')
        return signed
    }

    /**
     * Notify the wallet that the session is no longer needed and close the relay connection
     */
    async dispose() {
        this.signal?.removeEventListener('abort', this.onAbort)
        for (const waiter of this.waiters) {
            clearTimeout(waiter.timer)
        }
        this.waiters.clear()
        if (this.relay.isConnected) {
            const notifications = []
            if (this.sessionTopic) {
                notifications.push(this.sendRequest(this.sessionTopic, nextId(), 'wc_sessionDelete', disconnectReason))
            }
            if (this.pairingTopic) {
                notifications.push(this.sendRequest(this.pairingTopic, nextId(), 'wc_pairingDelete', disconnectReason))
            }
            let timer
            await Promise.race([
                Promise.allSettled(notifications),
                new Promise(resolve => timer = setTimeout(resolve, cleanupTimeout))
            ])
            clearTimeout(timer)
        }
        this.relay.close()
    }

    /**
     * @private
     */
    processMessage(topic, payload) {
        for (const waiter of this.waiters) {
            if (waiter.match(topic, payload)) {
                waiter.resolve(payload)
                return
            }
        }
        switch (payload.method) {
            case 'wc_sessionDelete':
                this.sendResult(topic, payload, true)
                    .catch(e => console.warn(e))
                this.sessionTopic = undefined
                this.fail(new Error('Wallet closed the session'))
                break
            case 'wc_pairingDelete':
                this.sendResult(topic, payload, true)
                    .catch(e => console.warn(e))
                this.pairingTopic = undefined
                //some wallets drop the pairing once the session is established
                if (!this.sessionTopic) {
                    this.fail(new Error('Wallet closed the connection'))
                }
                break
            case 'wc_sessionPing':
            case 'wc_pairingPing':
            case 'wc_sessionUpdate':
            case 'wc_sessionExtend':
            case 'wc_sessionEvent':
                this.sendResult(topic, payload, true)
                    .catch(e => console.warn(e))
                break
        }
    }

    /**
     * Abort all pending operations
     * @private
     */
    fail(error) {
        this.rejectFlow(error)
    }

    /**
     * Reject a pending operation once the flow fails
     * @private
     */
    guard(promise) {
        const guarded = Promise.race([promise, this.failure])
        guarded.catch(() => {})
        return guarded
    }

    /**
     * Wait for an incoming message matching the predicate
     * @private
     */
    waitFor(match, timeout, timeoutMessage) {
        const waiter = {match}
        const promise = new Promise((resolve, reject) => {
            waiter.resolve = payload => {
                clearTimeout(waiter.timer)
                this.waiters.delete(waiter)
                resolve(payload)
            }
            waiter.timer = setTimeout(() => {
                this.waiters.delete(waiter)
                reject(new Error(timeoutMessage))
            }, timeout)
        })
        this.waiters.add(waiter)
        return this.guard(promise)
    }

    /**
     * @private
     */
    waitForResponse(topic, id, ttl, timeoutMessage) {
        return this.waitFor((t, payload) => t === topic && payload.id === id && !payload.method, ttl * 1000, timeoutMessage)
    }

    /**
     * @private
     */
    sendRequest(topic, id, method, params) {
        const [tag, ttl] = rpcOpts[method]
        return this.relay.publish(topic, {id, jsonrpc: '2.0', method, params}, {tag, ttl, prompt: method === 'wc_sessionRequest'})
    }

    /**
     * @private
     */
    sendResult(topic, request, result) {
        const [tag, ttl] = rpcOpts[request.method]
        return this.relay.publish(topic, {id: request.id, jsonrpc: '2.0', result}, {tag: tag + 1, ttl})
    }
}

function findAccount(namespaces, chainId) {
    const prefix = chainId + ':'
    return namespaces?.stellar?.accounts?.find(account => account.startsWith(prefix))?.substring(prefix.length)
}

function formatRpcError(error) {
    return error?.message ? `: ${error.message}` : ''
}
