import {bytesToHex, deriveSymKey, generateX25519, hexToBytes, open, seal, topicOf} from '../signer/walletconnect/wc-crypto'
import {signXdr} from '../signer/walletconnect/wc-sign-client'

const account = 'GBJBA3HJPU6Q2PYFLOHLHQMJD2BQPVSABURMTNSHOMS6UUP4MWUTZHE2'
const walletMetadata = {name: 'Test Wallet', icons: [], redirect: {native: 'testwallet://'}}

/**
 * In-memory relay: routes published messages to subscribers, keeps undelivered messages in a mailbox
 */
class FakeRelay {
    constructor() {
        this.subscriptions = new Map()
        this.mailbox = new Map()
        this.published = []
        this.sockets = []
    }

    handle(client, msg) {
        if (!msg.method)
            return //subscription acknowledgement
        const {topic} = msg.params
        switch (msg.method) {
            case 'irn_subscribe':
                if (!this.subscriptions.has(topic)) {
                    this.subscriptions.set(topic, new Set())
                }
                this.subscriptions.get(topic).add(client)
                this.respond(client, msg.id, 'sub' + topic)
                for (const stored of this.mailbox.get(topic) || []) {
                    this.deliver(client, stored)
                }
                this.mailbox.delete(topic)
                break
            case 'irn_publish': {
                this.published.push({...msg.params, client})
                const receivers = [...this.subscriptions.get(topic) || []].filter(c => c !== client)
                if (receivers.length) {
                    for (const receiver of receivers) {
                        this.deliver(receiver, msg.params)
                    }
                } else {
                    if (!this.mailbox.has(topic)) {
                        this.mailbox.set(topic, [])
                    }
                    this.mailbox.get(topic).push(msg.params)
                }
                this.respond(client, msg.id, true)
                break
            }
        }
    }

    disconnect(client) {
        for (const subscribers of this.subscriptions.values()) {
            subscribers.delete(client)
        }
    }

    respond(client, id, result) {
        setTimeout(() => client.receive({id, jsonrpc: '2.0', result}))
    }

    deliver(client, {topic, message, tag}) {
        setTimeout(() => client.receive({
            id: Math.floor(Math.random() * 1e9),
            jsonrpc: '2.0',
            method: 'irn_subscription',
            params: {id: 'sub' + topic, data: {topic, message, tag, publishedAt: Date.now()}}
        }))
    }

    /**
     * Messages published by the dApp (decrypted with known keys)
     */
    dappMessages(keys) {
        return this.published
            .filter(p => p.client instanceof FakeWebSocket && keys.has(p.topic))
            .map(p => ({tag: p.tag, ttl: p.ttl, prompt: p.prompt, topic: p.topic, payload: open(keys.get(p.topic), p.message)}))
    }
}

class FakeWebSocket {
    static OPEN = 1

    constructor(url) {
        this.url = url
        this.readyState = 0
        relay.sockets.push(this)
        setTimeout(() => {
            if (FakeWebSocket.rejectWith) {
                this.readyState = 3
                this.onclose?.({code: 3000, reason: FakeWebSocket.rejectWith})
                return
            }
            this.readyState = FakeWebSocket.OPEN
            this.onopen?.()
            //live relay accepts the connection, then closes it for an unknown project id
            if (FakeWebSocket.closeAfterOpen) {
                setTimeout(() => this.close(FakeWebSocket.closeAfterOpen.code, FakeWebSocket.closeAfterOpen.reason))
            }
        })
    }

    send(data) {
        relay.handle(this, JSON.parse(data))
    }

    receive(msg) {
        if (this.readyState === FakeWebSocket.OPEN) {
            this.onmessage?.({data: JSON.stringify(msg)})
        }
    }

    close(code = 1006, reason = '') {
        if (this.readyState === 3)
            return
        this.readyState = 3
        relay.disconnect(this)
        this.onclose?.({code, reason})
    }
}

/**
 * Simulated wallet speaking Sign v2 protocol over the fake relay
 */
class FakeWallet {
    constructor({chains = ['stellar:testnet'], onProposal, onRequest} = {}) {
        this.chains = chains
        this.onProposal = onProposal
        this.onRequest = onRequest || (req => ({id: req.id, jsonrpc: '2.0', result: {signedXDR: 'SIGNED:' + req.params.request.params.xdr}}))
        this.keys = new Map()
        this.received = []
    }

    pair(uri) {
        const [, topic, query] = uri.match(/^wc:([0-9a-f]{64})@2\?(.+)$/)
        const params = new URLSearchParams(query)
        expect(params.get('relay-protocol')).toBe('irn')
        this.pairingTopic = topic
        this.subscribe(topic, hexToBytes(params.get('symKey')))
    }

    subscribe(topic, key) {
        this.keys.set(topic, key)
        relay.handle(this, {id: 1, jsonrpc: '2.0', method: 'irn_subscribe', params: {topic}})
    }

    publish(topic, payload, tag) {
        relay.handle(this, {id: 2, jsonrpc: '2.0', method: 'irn_publish', params: {topic, message: seal(this.keys.get(topic), payload), ttl: 300, tag}})
    }

    receive(msg) {
        if (msg.method !== 'irn_subscription')
            return
        const {topic, message} = msg.params.data
        const payload = open(this.keys.get(topic), message)
        this.received.push(payload)
        switch (payload.method) {
            case 'wc_sessionPropose':
                this.approve(payload)
                break
            case 'wc_sessionRequest': {
                const response = this.onRequest(payload, this)
                if (response) {
                    this.publish(topic, response, 1109)
                }
                break
            }
        }
    }

    approve(proposal) {
        this.proposal = proposal
        const custom = this.onProposal?.(proposal, this)
        if (custom) {
            this.publish(this.pairingTopic, custom, 1101)
            return
        }
        const keyPair = generateX25519()
        const sessionKey = deriveSymKey(keyPair.priv, proposal.params.proposer.publicKey)
        this.sessionTopic = topicOf(sessionKey)
        this.subscribe(this.sessionTopic, sessionKey)
        this.publish(this.sessionTopic, {
            id: 100,
            jsonrpc: '2.0',
            method: 'wc_sessionSettle',
            params: {
                relay: {protocol: 'irn'},
                controller: {publicKey: bytesToHex(keyPair.pub), metadata: walletMetadata},
                namespaces: {
                    stellar: {
                        chains: this.chains,
                        accounts: this.chains.map(chain => `${chain}:${account}`),
                        methods: ['stellar_signXDR', 'stellar_signAndSubmitXDR'],
                        events: []
                    }
                },
                expiry: Math.floor(Date.now() / 1000) + 604800
            }
        }, 1102)
        this.publish(this.pairingTopic, {
            id: proposal.id,
            jsonrpc: '2.0',
            result: {relay: {protocol: 'irn'}, responderPublicKey: bytesToHex(keyPair.pub)}
        }, 1101)
    }
}

let relay
const NativeWebSocket = global.WebSocket

function startSigning({wallet, signal, chainId = 'stellar:testnet'} = {}) {
    const statuses = []
    const promise = signXdr({
        xdr: 'TX_XDR',
        chainId,
        projectId: 'test-project',
        metadata: {name: 'Refractor', description: 'test', url: 'https://refractor.test', icons: []},
        signal,
        onStatus: status => {
            statuses.push(status)
            if (status?.stage === 'pairing' && wallet) {
                wallet.pair(status.uri)
            }
        }
    })
    return {promise, statuses}
}

beforeEach(() => {
    relay = new FakeRelay()
    FakeWebSocket.rejectWith = null
    FakeWebSocket.closeAfterOpen = null
    global.WebSocket = FakeWebSocket
    jest.spyOn(console, 'warn').mockImplementation(() => {
    })
})

afterEach(() => {
    global.WebSocket = NativeWebSocket
    jest.restoreAllMocks()
})

describe('signXdr', () => {
    test('pairs with a wallet, requests signature and drops the session', async () => {
        const wallet = new FakeWallet()
        const {promise, statuses} = startSigning({wallet})
        await expect(promise).resolves.toBe('SIGNED:TX_XDR')

        expect(statuses.map(s => s?.stage ?? null)).toEqual(['connecting', 'pairing', 'requesting', null])
        expect(statuses[1].uri).toMatch(/^wc:[0-9a-f]{64}@2\?relay-protocol=irn&symKey=[0-9a-f]{64}&expiryTimestamp=\d+$/)
        expect(statuses[2]).toEqual({stage: 'requesting', wallet: walletMetadata, account})

        //relay connection is authenticated
        const url = new URL(relay.sockets[0].url)
        expect(url.origin).toBe('wss://relay.walletconnect.org')
        expect(url.searchParams.get('projectId')).toBe('test-project')
        expect(url.searchParams.get('useOnCloseEvent')).toBe('true')
        expect(url.searchParams.get('auth').split('.')).toHaveLength(3)

        //session proposal
        const {params} = wallet.proposal
        expect(params.requiredNamespaces).toEqual({stellar: {chains: ['stellar:testnet'], methods: ['stellar_signXDR'], events: []}})
        expect(params.optionalNamespaces).toEqual(params.requiredNamespaces)
        expect(params.pairingTopic).toBe(wallet.pairingTopic)
        expect(params.proposer.metadata.name).toBe('Refractor')

        const sent = relay.dappMessages(wallet.keys)
        const byMethod = method => sent.find(m => m.payload.method === method)
        expect(byMethod('wc_sessionPropose')).toMatchObject({tag: 1100, ttl: 300, topic: wallet.pairingTopic})
        expect(sent.find(m => m.payload.id === 100)).toMatchObject({tag: 1103, topic: wallet.sessionTopic, payload: {result: true}})
        expect(byMethod('wc_sessionRequest')).toMatchObject({
            tag: 1108,
            prompt: true,
            topic: wallet.sessionTopic,
            payload: {params: {chainId: 'stellar:testnet', request: {method: 'stellar_signXDR', params: {xdr: 'TX_XDR'}}}}
        })
        expect(byMethod('wc_sessionDelete')).toMatchObject({tag: 1112, topic: wallet.sessionTopic, payload: {params: {code: 6000}}})
        expect(byMethod('wc_pairingDelete')).toMatchObject({tag: 1000, topic: wallet.pairingTopic})
        expect(relay.sockets[0].readyState).toBe(3)
    })

    test('accepts plain string signing result', async () => {
        const wallet = new FakeWallet({onRequest: req => ({id: req.id, jsonrpc: '2.0', result: 'PLAIN_SIGNED'})})
        await expect(startSigning({wallet}).promise).resolves.toBe('PLAIN_SIGNED')
    })

    test('accepts the SEP-43 signedTxXdr signing result', async () => {
        const wallet = new FakeWallet({
            onRequest: req => ({id: req.id, jsonrpc: '2.0', result: {signedTxXdr: 'SEP43_SIGNED', signerAddress: 'GSIGNER'}})
        })
        await expect(startSigning({wallet}).promise).resolves.toBe('SEP43_SIGNED')
    })

    test('fails when the wallet returns an unknown result shape', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {})
        const wallet = new FakeWallet({onRequest: req => ({id: req.id, jsonrpc: '2.0', result: {whatever: 'X'}})})
        await expect(startSigning({wallet}).promise).rejects.toThrow('Wallet returned no signed transaction')
    })

    test('fails when the wallet rejects the connection', async () => {
        const wallet = new FakeWallet({
            onProposal: proposal => ({id: proposal.id, jsonrpc: '2.0', error: {code: 5000, message: 'User rejected.'}})
        })
        await expect(startSigning({wallet}).promise).rejects.toThrow('Wallet rejected the connection: User rejected.')
    })

    test('fails when the user rejects the signing request', async () => {
        const wallet = new FakeWallet({
            onRequest: req => ({id: req.id, jsonrpc: '2.0', error: {code: 5000, message: 'User rejected the request'}})
        })
        const {promise} = startSigning({wallet})
        await expect(promise).rejects.toThrow('User rejected the request')
        //session is still cleaned up
        expect(relay.dappMessages(wallet.keys).some(m => m.payload.method === 'wc_sessionDelete')).toBe(true)
    })

    test('fails when the wallet does not support the requested network', async () => {
        const wallet = new FakeWallet({chains: ['stellar:pubnet']})
        await expect(startSigning({wallet}).promise).rejects.toThrow('Wallet does not support Stellar testnet network')
        expect(wallet.received.some(m => m.method === 'wc_sessionRequest')).toBe(false)
    })

    test('fails when the wallet closes the session while signing', async () => {
        const wallet = new FakeWallet({
            onRequest: (req, w) => {
                w.publish(w.sessionTopic, {id: 200, jsonrpc: '2.0', method: 'wc_sessionDelete', params: {code: 6000, message: 'bye'}}, 1112)
            }
        })
        await expect(startSigning({wallet}).promise).rejects.toThrow('Wallet closed the session')
        const sent = relay.dappMessages(wallet.keys)
        expect(sent.find(m => m.payload.id === 200)).toMatchObject({tag: 1113, payload: {result: true}})
        expect(sent.some(m => m.payload.method === 'wc_sessionDelete')).toBe(false)
    })

    test('answers wallet pings', async () => {
        const wallet = new FakeWallet({
            onRequest: (req, w) => {
                w.publish(w.sessionTopic, {id: 300, jsonrpc: '2.0', method: 'wc_sessionPing', params: {}}, 1114)
                setTimeout(() => w.publish(w.sessionTopic, {id: req.id, jsonrpc: '2.0', result: {signedXDR: 'SIGNED'}}, 1109), 10)
            }
        })
        await expect(startSigning({wallet}).promise).resolves.toBe('SIGNED')
        expect(relay.dappMessages(wallet.keys).find(m => m.payload.id === 300)).toMatchObject({tag: 1115, payload: {result: true}})
    })

    test('can be cancelled while waiting for the wallet', async () => {
        const controller = new AbortController()
        const {promise, statuses} = startSigning({signal: controller.signal})
        await waitUntil(() => statuses.some(s => s?.stage === 'pairing'))
        controller.abort()
        await expect(promise).rejects.toThrow('Cancelled')
        expect(statuses[statuses.length - 1]).toBeNull()
        expect(relay.sockets[0].readyState).toBe(3)
        //the wallet never scanned the code, so there is nothing to delete
        expect(relay.published.filter(p => p.tag === 1000 || p.tag === 1112)).toHaveLength(0)
    })

    test('reports relay connection errors', async () => {
        FakeWebSocket.rejectWith = 'Invalid project id'
        await expect(startSigning().promise).rejects.toThrow('WalletConnect relay connection failed: Invalid project id')
    })

    test('fails immediately when the relay rejects the project id after connecting', async () => {
        FakeWebSocket.closeAfterOpen = {code: 3000, reason: 'Project not found'}
        await expect(startSigning().promise).rejects.toThrow('WalletConnect relay rejected the connection: Project not found')
        expect(relay.sockets).toHaveLength(1) //no reconnection attempts
    })

    test('restores the connection when the page becomes visible again', async () => {
        const wallet = new FakeWallet({
            onRequest: (req, w) => {
                //browser tab got suspended while the user was signing in the wallet app
                relay.sockets[0].close()
                w.publish(w.sessionTopic, {id: req.id, jsonrpc: '2.0', result: {signedXDR: 'SIGNED_LATER'}}, 1109)
                setTimeout(() => document.dispatchEvent(new Event('visibilitychange')), 10)
            }
        })
        jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
        await expect(startSigning({wallet}).promise).resolves.toBe('SIGNED_LATER')
        expect(relay.sockets).toHaveLength(2)
        //new connection uses fresh auth token
        expect(relay.sockets[1].url).not.toBe(relay.sockets[0].url)
    })
})

async function waitUntil(predicate) {
    for (let i = 0; i < 100; i++) {
        if (predicate())
            return
        await new Promise(resolve => setTimeout(resolve, 5))
    }
    throw new Error('Condition not met')
}
